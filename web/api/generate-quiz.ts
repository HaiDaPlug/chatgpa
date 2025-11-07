/**
 * DO NOT CHANGE CONTRACTS OR SCHEMA.
 * - Auth: Bearer <supabase access token> (anon client w/ RLS)
 * - Errors: { code, message } only. Codes: LIMIT_EXCEEDED | SCHEMA_INVALID | NOT_FOUND | OPENAI_ERROR | UNAUTHORIZED | SERVER_ERROR
 * - No service role keys, no schema edits, no new deps.
 * - Limits: Free = max 1 class, 5 quizzes (created).
 */

// Purpose: Generate quiz from notes using OpenAI (RLS-enabled)
// Connects to: /generate page, quizzes table, usage_limits table

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";
import { MODEL, validateAIConfig } from "./_lib/ai.js";
import { alphaRateLimit, alphaLimitsEnabled } from "./_lib/alpha-limit.js";
import { getUserPlan, getQuizCount } from "./_lib/plan.js";
import { generateWithRouter } from "./_lib/ai-router.js";
import { insertGenerationAnalytics, insertGenerationFailure, type Question } from "./_lib/analytics-service.js";

// Input schema
const Body = z.object({
  class_id: z.string().uuid().nullable().optional(), // optional - standalone quizzes allowed
  notes_text: z.string().trim().min(20, "Notes text must be at least 20 characters").max(50000, "Notes text too long (max 50,000 characters)"),
});

// Quiz question schemas (from quiz-schema.ts)
const mcqQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('mcq'),
  prompt: z.string().max(180),
  options: z.array(z.string()).min(3).max(5),
  answer: z.string(),
}).refine((data) => data.options.includes(data.answer), {
  message: 'MCQ answer must match one of the options',
});

const shortQuestionSchema = z.object({
  id: z.string(),
  type: z.literal('short'),
  prompt: z.string().max(180),
  answer: z.string(),
});

const questionSchema = z.discriminatedUnion('type', [mcqQuestionSchema, shortQuestionSchema]);

const quizResponseSchema = z.object({
  questions: z.array(questionSchema).min(5).max(10),
});

// Structured logging
function log(level: 'info' | 'error' | 'warn', context: any, message: string) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, ...context, message }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const request_id = randomUUID();

  res.setHeader('Content-Type', 'application/json');

  if (req.method !== "POST") {
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Only POST allowed" });
  }

  // Alpha rate limiting (optional, flag-gated)
  if (alphaLimitsEnabled()) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() || "unknown";
    const verdict = alphaRateLimit(`${ip}:generate-quiz`);
    if (!verdict.allow) {
      log('warn', { request_id, route: '/api/generate-quiz', ip, retryAfter: verdict.retryAfter }, 'Alpha rate limit exceeded');
      return res.status(429).json({
        code: "RATE_LIMITED",
        message: `Too many requests. Try again in ${verdict.retryAfter}s.`
      });
    }
  }

  try {
    // Validate critical environment variables
    const requiredEnvVars = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value?.trim())
      .map(([key]) => key);

    if (missingVars.length > 0) {
      log('error', {
        request_id,
        route: '/api/generate-quiz',
        missing_vars: missingVars
      }, 'Missing required environment variables');

      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Service configuration error"
      });
    }

    // Validate AI configuration
    const aiConfigCheck = validateAIConfig();
    if (!aiConfigCheck.valid) {
      log('error', {
        request_id,
        route: '/api/generate-quiz',
        error: aiConfigCheck.error
      }, 'AI configuration validation failed');

      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "AI service configuration error"
      });
    }

    // Auth passthrough (RLS relies on this token)
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      log('error', { request_id, route: '/api/generate-quiz' }, 'Missing auth header');
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing or invalid authorization header" });
    }

    const access_token = auth.split(" ")[1];

    // Supabase client bound to user token (enables RLS)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${access_token}` } },
        auth: { persistSession: false }
      }
    );

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      log('error', { request_id, route: '/api/generate-quiz' }, 'Invalid token');
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
    }

    const user_id = user.id;

    // Validate body
    const parse = Body.safeParse(req.body ?? {});
    if (!parse.success) {
      const firstError = parse.error.issues[0];
      const errorMsg = firstError?.message ?? "Invalid request body";
      log('error', { request_id, route: '/api/generate-quiz', user_id, validation_error: errorMsg }, 'Schema validation failed');
      return res.status(400).json({
        code: "SCHEMA_INVALID",
        message: errorMsg
      });
    }

    const { class_id, notes_text } = parse.data;

    // Verify class ownership if class_id provided (RLS should handle this, but double-check)
    if (class_id) {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('id', class_id)
        .single();

      if (classError || !classData) {
        log('error', { request_id, route: '/api/generate-quiz', user_id, class_id }, 'Class not found or access denied');
        return res.status(404).json({ code: "NOT_FOUND", message: "Class not found or access denied" });
      }
    }

    // Enforce Free tier limits (protect OpenAI costs)
    const LIMITS_ENABLED = (process.env.ENABLE_USAGE_LIMITS || "true").toLowerCase() === "true";
    const FREE_QUIZ_LIMIT = Number(process.env.FREE_QUIZ_LIMIT || 5);

    if (LIMITS_ENABLED) {
      const plan = await getUserPlan(supabase, user_id);
      if (plan.tier === "free") {
        const { count, ok } = await getQuizCount(supabase, user_id);
        if (!ok) {
          log('error', { request_id, route: '/api/generate-quiz', user_id }, 'Failed to count quizzes');
          return res.status(500).json({ code: "SERVER_ERROR", message: "Failed to check usage limits" });
        }

        if (count >= FREE_QUIZ_LIMIT) {
          log('warn', { request_id, route: '/api/generate-quiz', user_id, quizzes_count: count }, 'Free tier limit exceeded');
          return res.status(402).json({
            code: "USAGE_LIMIT_REACHED",
            message: `You've reached the Free plan limit of ${FREE_QUIZ_LIMIT} quizzes.`,
            upgrade_hint: "Upgrade to continue generating unlimited quizzes.",
            current_count: count,
            limit: FREE_QUIZ_LIMIT,
          });
        }
      }
    }

    // Call OpenAI to generate quiz
    const prompt = `You are ChatGPA's quiz generator.

Goal
- Create a concise quiz strictly from the provided NOTES.
- Return **JSON only** with this shape (no prose, no markdown):

{
  "questions": [
    {
      "id": "q1",
      "type": "mcq" | "short",
      "prompt": "string",
      "options": ["string","string","string","string"],  // mcq only
      "answer": "string"                                 // for mcq: must equal one option; for short: concise gold answer
    }
  ]
}

Constraints
- Length: 5–10 questions total. If NOTES are short/light, prefer 5; otherwise 8 (cap at 10).
- Types: Use a **hybrid** mix that best fits the material (definitions/comparisons → more short; facts/terms → more mcq).
- MCQ: 4 plausible options; single correct answer **must** exactly match one option.
- Prompts ≤180 chars; unambiguous; no trivia.
- **Language:** write in the same language as the NOTES.
- **No outside knowledge.** Every prompt and answer must be directly supported by NOTES.

Coverage & quality rules
- Cover the **main sections / ideas** of NOTES (not just one corner).
- Avoid duplicates and near-duplicates.
- Prefer concept-level understanding over exact wording.
- Keep answers short and precise (1–2 sentences or key phrase).

NOTES:
${notes_text}

Now generate the quiz JSON.`;

    // Call AI router with automatic fallback and analytics
    // Router handles: model selection, parameter building, fallback logic, metrics collection
    const routerResult = await generateWithRouter({
      task: "quiz_generation",
      prompt,
      context: {
        notes_length: notes_text.length,
        question_count: 8, // Target question count (router will optimize)
        request_id: request_id, // Pass request_id for log correlation
      },
    });

    // Handle router failure (both attempts failed or non-retryable error)
    if (!routerResult.success) {
      const error = routerResult.error!;

      // Insert failure analytics (fire-and-forget: don't await, truly non-blocking)
      insertGenerationFailure(
        user_id,
        routerResult.metrics,
        error.code,
        error.message,
        {
          type: class_id ? "class" : "paste",
          note_size: notes_text.length,
        }
      ).catch((err) => {
        console.error("ANALYTICS_FAILURE_INSERT_ERROR", {
          request_id: routerResult.metrics.request_id,
          error: err?.message,
        });
      });

      // Map router error codes to API error codes
      const statusCode = error.code === "RATE_LIMIT" ? 429 : error.code === "AUTH_ERROR" ? 500 : 500;

      log("error", {
        request_id: routerResult.metrics.request_id,
        route: "/api/generate-quiz",
        user_id,
        error_code: error.code,
        error_message: error.message,
        model_used: routerResult.metrics.model_used,
        fallback_triggered: routerResult.metrics.fallback_triggered,
        attempt_count: routerResult.metrics.attempt_count,
        latency_ms: routerResult.metrics.latency_ms,
      }, "Router generation failed");

      return res.status(statusCode).json({
        code: "OPENAI_ERROR",
        message: error.message || "Failed to generate quiz. Please try again.",
      });
    }

    // Success: Extract content and log metrics
    const raw = routerResult.content!;

    log("info", {
      request_id: routerResult.metrics.request_id,
      route: "/api/generate-quiz",
      user_id,
      model_used: routerResult.metrics.model_used,
      model_family: routerResult.metrics.model_family,
      fallback_triggered: routerResult.metrics.fallback_triggered,
      attempt_count: routerResult.metrics.attempt_count,
      latency_ms: routerResult.metrics.latency_ms,
      tokens_total: routerResult.metrics.tokens_total,
    }, "Router generation succeeded");

    let quizJson;
    try {
      quizJson = JSON.parse(raw);
    } catch {
      log('error', { request_id: routerResult.metrics.request_id, route: '/api/generate-quiz', user_id }, 'Non-JSON response from model');
      return res.status(400).json({ code: "SCHEMA_INVALID", message: "Non-JSON response from model" });
    }

    // Validate quiz structure with Zod
    const quizValidation = quizResponseSchema.safeParse(quizJson);
    if (!quizValidation.success) {
      log('error', { request_id: routerResult.metrics.request_id, route: '/api/generate-quiz', user_id }, 'Quiz validation failed');
      return res.status(500).json({
        code: "SCHEMA_INVALID",
        message: "Generated quiz failed validation"
      });
    }

    // Insert quiz into database (RLS ensures user_id is set correctly)
    const { data: quizData, error: insertError } = await supabase
      .from('quizzes')
      .insert({
        user_id,
        class_id,
        questions: quizValidation.data.questions,
      })
      .select('id')
      .single();

    if (insertError || !quizData) {
      log('error', { request_id, route: '/api/generate-quiz', user_id, class_id, error: insertError?.message }, 'Failed to insert quiz');
      return res.status(500).json({ code: "SERVER_ERROR", message: "Failed to save quiz" });
    }

    // Insert generation analytics (fire-and-forget: don't await, truly non-blocking)
    insertGenerationAnalytics(
      quizData.id,
      user_id,
      routerResult.metrics,
      quizValidation.data.questions as Question[],
      {
        type: class_id ? "class" : "paste",
        note_size: notes_text.length,
      }
    ).catch((err) => {
      // Non-critical: log but don't fail quiz generation
      console.error("ANALYTICS_INSERT_ERROR", {
        request_id: routerResult.metrics.request_id,
        quiz_id: quizData.id,
        error: err?.message,
      });
    });

    log('info', {
      request_id: routerResult.metrics.request_id,
      route: '/api/generate-quiz',
      user_id,
      class_id,
      quiz_id: quizData.id,
      model_used: routerResult.metrics.model_used,
      latency_ms: routerResult.metrics.latency_ms,
      fallback_triggered: routerResult.metrics.fallback_triggered,
    }, 'Quiz generated successfully');

    return res.status(200).json({ quiz_id: quizData.id });

  } catch (error: any) {
    // Enhanced error logging for debugging
    log('error', {
      request_id,
      route: '/api/generate-quiz',
      user_id: req.body?.user_id ?? 'unknown',
      error_message: error.message,
      error_stack: error.stack?.split('\n').slice(0, 3).join(' | '),
      error_code: error.code,
      error_status: error.status,
      error_name: error.name
    }, 'Unhandled error in generate-quiz');

    return res.status(500).json({ code: "SERVER_ERROR", message: "Internal server error" });
  }
}
