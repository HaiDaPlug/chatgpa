// Purpose: Generate quiz from notes using AI Router (gateway action)
// Migrated from: /api/generate-quiz.ts
// Connects to: quizzes table, usage_limits, analytics

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { GatewayContext } from '../../_types.js';
import { GenerateQuizInput, GenerateQuizOutput, quizResponseSchema } from '../_schemas.js';
import { validateAIConfig } from '../../../_lib/ai.js';
import { getUserPlan, getQuizCount } from '../../../_lib/plan.js';
import { generateWithRouter } from '../../../_lib/ai-router.js';
import {
  insertGenerationAnalytics,
  insertGenerationFailure,
  type Question
} from '../../../_lib/analytics-service.js';
import { generateQuizMetadata } from '../../../_lib/auto-naming.js';
import {
  validateAndNormalizeConfig,
  DEFAULT_QUIZ_CONFIG
} from '../../../_lib/quiz-config-schema.js';
import type { QuizConfig } from '../../../../shared/types';
import { buildQuizGenerationPrompt } from '../../../_lib/prompt-builder.js';

/**
 * Generate Quiz Action
 * Creates a quiz from provided notes using AI Router with fallback
 */
export async function generateQuiz(
  data: unknown,
  context: GatewayContext
): Promise<{ quiz_id: string; config: QuizConfig; actual_question_count: number }> {
  const { request_id, token, user_id } = context;

  // 1. Validate input
  const parse = GenerateQuizInput.safeParse(data);
  if (!parse.success) {
    const firstError = parse.error.issues[0];
    throw {
      code: 'SCHEMA_INVALID',
      message: firstError?.message ?? 'Invalid request data',
      status: 400
    };
  }

  const { class_id, notes_text, config: inputConfig } = parse.data;

  // 2. Validate AI configuration
  const aiConfigCheck = validateAIConfig();
  if (!aiConfigCheck.valid) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'generate_quiz',
        error: aiConfigCheck.error,
        message: 'AI configuration validation failed'
      })
    );
    throw {
      code: 'SERVER_ERROR',
      message: 'AI service configuration error',
      status: 500
    };
  }

  // 3. Normalize quiz config (apply defaults)
  let quizConfig: QuizConfig;
  try {
    quizConfig = validateAndNormalizeConfig(inputConfig);
  } catch (error: any) {
    throw {
      code: 'CONFIG_INVALID',
      message: error.message || 'Invalid quiz configuration',
      status: 400
    };
  }

  // 4. Create Supabase client with user token (RLS)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'generate_quiz',
        error: 'Missing Supabase configuration',
        env_missing: [
          !supabaseUrl && 'SUPABASE_URL',
          !supabaseAnonKey && 'SUPABASE_ANON_KEY'
        ].filter(Boolean),
        message: 'Supabase environment variables not configured'
      })
    );
    throw {
      code: 'SERVER_ERROR',
      message: 'Database configuration error',
      status: 500
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });

  // 5. Verify class ownership and fetch name (if class_id provided)
  let className: string | null = null;
  if (class_id) {
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('id', class_id)
      .single();

    if (classError || !classData) {
      throw {
        code: 'NOT_FOUND',
        message: 'Class not found or access denied',
        status: 404
      };
    }

    className = classData.name;
  }

  // 6. Enforce free tier limits (protect OpenAI costs)
  const LIMITS_ENABLED =
    (process.env.ENABLE_USAGE_LIMITS || 'true').toLowerCase() === 'true';

  // ✅ Dev override: APP_MODE=test allows 100 quizzes for testing
  const FREE_QUIZ_LIMIT =
    process.env.APP_MODE === 'test'
      ? 100
      : Number(process.env.FREE_QUIZ_LIMIT || 5);

  // Optional: Log when dev override is active
  if (process.env.APP_MODE === 'test') {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        context: 'usage_limits',
        message: 'Dev override active: FREE_QUIZ_LIMIT=100 (APP_MODE=test)'
      })
    );
  }

  if (LIMITS_ENABLED && user_id) {
    const plan = await getUserPlan(supabase, user_id);
    if (plan.tier === 'free') {
      const { count, ok } = await getQuizCount(supabase, user_id);
      if (!ok) {
        throw {
          code: 'SERVER_ERROR',
          message: 'Failed to check usage limits',
          status: 500
        };
      }

      if (count >= FREE_QUIZ_LIMIT) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'warn',
            request_id,
            user_id,
            action: 'generate_quiz',
            quizzes_count: count,
            message: 'Free tier limit exceeded'
          })
        );
        throw {
          code: 'USAGE_LIMIT_REACHED',
          message: `You've reached the Free plan limit of ${FREE_QUIZ_LIMIT} quizzes.`,
          status: 402
        };
      }
    }
  }

  // 7. Build dynamic prompt based on config
  const prompt = buildQuizGenerationPrompt({
    config: quizConfig,
    notesText: notes_text
  });

  // 8. Call AI Router with automatic fallback + retry on transient errors
  let routerResult;
  let retryAttempted = false;
  const parentRequestId = request_id; // Preserve for tracing

  // Feature flag: enable/disable retry (set in .env, defaults to enabled)
  const ENABLE_MODEL_RETRY = process.env.ENABLE_MODEL_RETRY !== 'false';

  // Try generation with single retry on transient errors
  while (true) {
    try {
      // Use new request_id for retry to avoid log confusion
      const currentRequestId = retryAttempted ? randomUUID() : parentRequestId;

      routerResult = await generateWithRouter({
        task: 'quiz_generation',
        prompt,
        context: {
          notes_length: notes_text.length,
          question_count: quizConfig.question_count,
          request_id: currentRequestId,
          config: quizConfig
        }
      });
      break; // Success
    } catch (routerError: any) {
      // Check if it's a transient model error
      const isTransientModelError =
        routerError.code === 'MODEL_EMPTY_RESPONSE' ||
        routerError.code === 'MODEL_NON_JSON';

      // Single retry for transient errors (if feature enabled)
      if (isTransientModelError && !retryAttempted && ENABLE_MODEL_RETRY) {
        retryAttempted = true;
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          parent_request_id: parentRequestId,
          user_id,
          event: 'RETRYING_GENERATION',
          reason: routerError.code,
          message: 'Retrying after transient model error (new request_id will be generated)'
        }));
        continue; // Retry once
      }

      // Final failure or non-retryable error
      if (isTransientModelError) {
        // Map to user-friendly error after retry exhausted
        throw {
          code: 'MODEL_INVALID_OUTPUT',
          message: 'AI returned an invalid response after retry. Please try generating again.',
          status: 502
        };
      }

      // Re-throw non-transient errors unchanged
      throw routerError;
    }
  }

  // 9. Handle router failure
  if (!routerResult.success) {
    const error = routerResult.error!;

    // Insert failure analytics (fire-and-forget)
    insertGenerationFailure(
      user_id || 'unknown',
      routerResult.metrics,
      error.code,
      error.message,
      {
        type: class_id ? 'class' : 'paste',
        note_size: notes_text.length
      }
    ).catch((err) => {
      console.error(
        'ANALYTICS_FAILURE_INSERT_ERROR',
        {
          request_id: routerResult.metrics.request_id,
          error: err?.message
        }
      );
    });

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id: routerResult.metrics.request_id,
        user_id,
        action: 'generate_quiz',
        error_code: error.code,
        error_message: error.message,
        model_used: routerResult.metrics.model_used,
        fallback_triggered: routerResult.metrics.fallback_triggered,
        attempt_count: routerResult.metrics.attempt_count,
        latency_ms: routerResult.metrics.latency_ms,
        message: 'Router generation failed'
      })
    );

    const statusCode =
      error.code === 'RATE_LIMIT' ? 429 : error.code === 'AUTH_ERROR' ? 500 : 500;

    throw {
      code: 'OPENAI_ERROR',
      message: error.message || 'Failed to generate quiz. Please try again.',
      status: statusCode
    };
  }

  // 10. Parse and validate response
  const raw = routerResult.content!;

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id: routerResult.metrics.request_id,
      user_id,
      action: 'generate_quiz',
      model_used: routerResult.metrics.model_used,
      model_family: routerResult.metrics.model_family,
      fallback_triggered: routerResult.metrics.fallback_triggered,
      attempt_count: routerResult.metrics.attempt_count,
      latency_ms: routerResult.metrics.latency_ms,
      tokens_total: routerResult.metrics.tokens_total,
      message: 'Router generation succeeded'
    })
  );

  let quizJson;
  try {
    quizJson = JSON.parse(raw);
  } catch (parseError) {
    // Belt-and-suspenders: Should never reach here after router validation + repair
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      request_id: routerResult.metrics.request_id,
      user_id,
      action: 'generate_quiz',
      error: 'JSON_PARSE_FAILED_AFTER_ROUTER',
      content_length: raw.length,
      content_preview: raw.slice(0, 200),
      message: 'Unexpected: JSON.parse failed after router validated content'
    }));

    throw {
      code: 'MODEL_INVALID_OUTPUT',
      message: 'AI returned an invalid response. Please try again.',
      status: 502
    };
  }

  // Validate quiz structure with Zod
  const quizValidation = quizResponseSchema.safeParse(quizJson);
  if (!quizValidation.success) {
    // Log validation failure details for debugging
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id: routerResult.metrics.request_id,
        user_id,
        action: 'generate_quiz',
        error: 'Quiz validation failed',
        validation_errors: quizValidation.error.issues,
        quiz_structure: {
          has_questions: !!quizJson?.questions,
          question_count: quizJson?.questions?.length,
          first_question_sample: quizJson?.questions?.[0] ? {
            id: quizJson.questions[0].id,
            type: quizJson.questions[0].type,
            has_prompt: !!quizJson.questions[0].prompt,
            has_options: !!quizJson.questions[0].options,
            has_answer: !!quizJson.questions[0].answer,
            prompt_length: quizJson.questions[0].prompt?.length
          } : null
        },
        message: 'Generated quiz failed Zod validation'
      })
    );

    throw {
      code: 'QUIZ_VALIDATION_FAILED',
      message: 'Generated quiz did not match expected schema',
      details: quizValidation.error.issues.slice(0, 3).map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      })),
      status: 500
    };
  }

  // 11. Auto-generate title and subject
  const { title, subject } = generateQuizMetadata(
    notes_text,
    className,
    quizValidation.data.questions.length
  );

  // 12. Insert quiz into database
  const { data: quizData, error: insertError } = await supabase
    .from('quizzes')
    .insert({
      user_id,
      class_id,
      questions: quizValidation.data.questions,
      title,
      subject,
      meta: { config: quizConfig } // Section 4: Store config
    })
    .select('id')
    .single();

  if (insertError || !quizData) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'generate_quiz',
        class_id,
        error: insertError?.message,
        message: 'Failed to insert quiz'
      })
    );
    throw {
      code: 'SERVER_ERROR',
      message: 'Failed to save quiz',
      status: 500
    };
  }

  // 13. Insert generation analytics (fire-and-forget)
  insertGenerationAnalytics(
    quizData.id,
    user_id || 'unknown',
    routerResult.metrics,
    quizValidation.data.questions as Question[],
    {
      type: class_id ? 'class' : 'paste',
      note_size: notes_text.length
    },
    quizConfig
  ).catch((err) => {
    console.error('ANALYTICS_INSERT_ERROR', {
      request_id: routerResult.metrics.request_id,
      quiz_id: quizData.id,
      error: err?.message
    });
  });

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id: routerResult.metrics.request_id,
      user_id,
      action: 'generate_quiz',
      class_id,
      quiz_id: quizData.id,
      model_used: routerResult.metrics.model_used,
      latency_ms: routerResult.metrics.latency_ms,
      fallback_triggered: routerResult.metrics.fallback_triggered,
      message: 'Quiz generated successfully'
    })
  );

  // 14. Return result
  const actualQuestionCount = quizValidation.data.questions.length;

  return {
    quiz_id: quizData.id,
    config: quizConfig,
    actual_question_count: actualQuestionCount
  };
}
