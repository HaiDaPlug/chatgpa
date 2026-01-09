// Purpose: Grade quiz submission (gateway action)
// Migrated from: /api/grade.ts
// Connects to: quiz_attempts table, grading analytics

import { createClient } from '@supabase/supabase-js';
import type { GatewayContext } from '../../_types.js';
import { GradeInput } from '../_schemas.js';
import { gradeSubmission, type Question } from '../../../_lib/grader.js';
import {
  insertGradingAnalytics,
  insertGradingFailure
} from '../../../_lib/grading-analytics.js';
import { RUBRIC_VERSION } from '../../../_lib/rubric-engine.js';
import type { RouterMetrics } from '../../../_lib/ai-router.js';

/**
 * Grade Action
 * Grades a quiz submission with rubric-based scoring
 * Supports two flows:
 * 1. Section 3 flow: Submit existing in_progress attempt (attempt_id)
 * 2. Demo mode: Instant grade from quiz_id (creates new attempt)
 */
export async function grade(
  data: unknown,
  context: GatewayContext
): Promise<{
  attempt_id: string;
  score: number;
  letter: string;
  summary: string;
  breakdown: any[];
}> {
  const { request_id, token, user_id } = context;

  // 1. Validate input
  const parse = GradeInput.safeParse(data);
  if (!parse.success) {
    const firstError = parse.error.issues[0];
    throw {
      code: 'SCHEMA_INVALID',
      message: firstError?.message ?? 'Invalid request data',
      status: 400
    };
  }

  const { quiz_id, attempt_id: input_attempt_id, responses } = parse.data;

  // 2. Check demo mode
  const isDemoMode = process.env.DEMO_INSTANT_GRADE === 'true';

  if (!input_attempt_id && !quiz_id) {
    throw {
      code: 'BAD_REQUEST',
      message: 'Must provide either attempt_id or quiz_id',
      status: 400
    };
  }

  // 3. Create Supabase client with user token (RLS)
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    }
  );

  let actualQuizId: string;
  let actualAttemptId: string;
  let questions: any[];
  let started_at: string | null = null;

  // 4. Determine flow and fetch data
  if (input_attempt_id) {
    // Flow 1: Submit existing in_progress attempt
    const { data: attemptData, error: attemptError } = await supabase
      .from('quiz_attempts')
      .select('id, quiz_id, status, started_at, quiz:quizzes(id, questions)')
      .eq('id', input_attempt_id)
      .eq('user_id', user_id!)
      .single();

    if (attemptError || !attemptData) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          user_id,
          action: 'grade',
          attempt_id: input_attempt_id,
          message: 'Attempt not found or access denied'
        })
      );
      throw {
        code: 'NOT_FOUND',
        message: 'Attempt not found or access denied',
        status: 404
      };
    }

    if (attemptData.status !== 'in_progress') {
      throw {
        code: 'BAD_REQUEST',
        message: 'Attempt already submitted',
        status: 400
      };
    }

    actualQuizId = attemptData.quiz_id;
    actualAttemptId = attemptData.id;
    started_at = attemptData.started_at;
    questions = Array.isArray((attemptData.quiz as any)?.questions)
      ? (attemptData.quiz as any).questions
      : [];
  } else {
    // Flow 2: Demo mode (instant grade) - create new attempt
    const { data: quiz, error: qErr } = await supabase
      .from('quizzes')
      .select('id, questions')
      .eq('id', quiz_id!)
      .single();

    if (qErr || !quiz) {
      throw {
        code: 'NOT_FOUND',
        message: 'Quiz not found',
        status: 404
      };
    }

    actualQuizId = quiz.id;
    questions = Array.isArray(quiz.questions) ? quiz.questions : [];

    // Create new attempt in submitted state (demo mode - no in_progress phase)
    const { data: newAttempt, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_id: actualQuizId,
        user_id: user_id!,
        status: 'submitted',
        responses
      })
      .select('id, started_at')
      .single();

    if (insertError || !newAttempt) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          user_id,
          action: 'grade',
          quiz_id: actualQuizId,
          error: insertError?.message,
          message: 'Failed to create attempt'
        })
      );
      throw {
        code: 'DB_ERROR',
        message: insertError?.message || 'Failed to create attempt',
        status: 400
      };
    }

    actualAttemptId = newAttempt.id;
    started_at = newAttempt.started_at;
  }

  if (questions.length === 0) {
    throw {
      code: 'EMPTY_QUIZ',
      message: 'Quiz has no questions',
      status: 400
    };
  }

  // 5. Grade submission (rubric-based)
  const gradingStartMs = Date.now();
  const result = await gradeSubmission(questions as Question[], responses);
  const gradingLatencyMs = Date.now() - gradingStartMs;

  // 6. Update attempt with grading results (atomic)
  const submitted_at = new Date().toISOString();
  const duration_ms = started_at
    ? Date.now() - new Date(started_at).getTime()
    : gradingLatencyMs;

  const { data: updatedAttempt, error: updateError } = await supabase
    .from('quiz_attempts')
    .update({
      status: 'submitted',
      responses,
      score: result.percent / 100, // Store as 0..1 decimal
      grading: result.breakdown,
      submitted_at,
      duration_ms,
      grading_model: 'deterministic', // Will become actual model when AI grading implemented
      metrics: {
        tokens_in: null,
        tokens_out: null,
        latency_ms: gradingLatencyMs,
        fallback_happened: false
      }
    })
    .eq('id', actualAttemptId)
    .eq('user_id', user_id!) // Double-check ownership
    .select('id')
    .single();

  if (updateError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'grade',
        attempt_id: actualAttemptId,
        error: updateError.message,
        message: 'Failed to update attempt with grading'
      })
    );
    throw {
      code: 'DB_ERROR',
      message: updateError.message || 'Failed to save grading',
      status: 400
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      user_id,
      action: 'grade',
      quiz_id: actualQuizId,
      attempt_id: actualAttemptId,
      score: result.percent,
      duration_ms,
      message: 'Grading completed'
    })
  );

  // 7. Calculate letter grade
  const letter =
    result.percent >= 90
      ? 'A'
      : result.percent >= 80
        ? 'B'
        : result.percent >= 70
          ? 'C'
          : result.percent >= 60
            ? 'D'
            : 'F';

  // 8. Count question types for analytics
  const questionTypeBreakdown = {
    mcq: questions.filter((q: any) => q.type === 'mcq').length,
    short: questions.filter((q: any) => q.type === 'short').length,
    long: questions.filter((q: any) => q.type === 'long').length
  };

  // 9. Insert grading analytics (fire-and-forget)
  // Note: Current grading is deterministic (MCQ exact match, Short fuzzy match)
  // When AI grading is added for long answers, this will use real router metrics
  const routerMetrics: RouterMetrics = {
    request_id,
    model_used: 'deterministic', // Will become actual model when AI grading is implemented
    model_family: 'standard',
    fallback_triggered: false,
    model_decision_reason: 'deterministic_grading', // No AI model decision yet
    attempt_count: 1,
    latency_ms: gradingLatencyMs,
    tokens_prompt: undefined, // No AI call yet
    tokens_completion: undefined,
    tokens_total: undefined
  };

  insertGradingAnalytics(
    actualAttemptId,
    user_id || 'unknown',
    actualQuizId,
    routerMetrics,
    [], // Grading results will be populated when AI grading is fully implemented
    questionTypeBreakdown,
    RUBRIC_VERSION
  ).catch((err) => {
    console.error('GRADING_ANALYTICS_INSERT_ERROR', {
      request_id,
      attempt_id: actualAttemptId,
      error: err?.message
    });
  });

  // 10. Return result
  return {
    attempt_id: actualAttemptId,
    score: result.percent,
    letter,
    summary: result.summary,
    breakdown: result.breakdown
  };
}
