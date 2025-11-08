// Purpose: Grade a quiz submission with router-based grading + analytics.
// Section 3: Updated to work with in_progress → submitted transition
// Error shape: { code, message } only. Uses anon client + user Bearer for RLS.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { gradeSubmission, type Question } from "../src/lib/grader.js";
import { randomUUID } from "crypto";
import { alphaRateLimit, alphaLimitsEnabled } from "./_lib/alpha-limit.js";
import { insertGradingAnalytics, insertGradingFailure } from "./_lib/grading-analytics.js";
import { RUBRIC_VERSION } from "./_lib/rubric-engine.js";
import type { RouterMetrics } from "./_lib/ai-router.js";

type BodyShape = {
  quiz_id?: string; // Optional: for demo mode (instant grade)
  attempt_id?: string; // Required for Section 3 flow (submit existing attempt)
  responses: Record<string, string>;
};

function err(code: string, message: string, status = 400, res: VercelResponse) {
  return res.status(status).json({ code, message });
}

function log(level: 'info' | 'error' | 'warn', context: any, message: string) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, ...context, message }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const request_id = randomUUID();
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== "POST") {
    return err("METHOD_NOT_ALLOWED", "Only POST allowed", 405, res);
  }

  // Alpha rate limiting (optional, flag-gated)
  if (alphaLimitsEnabled()) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(",")[0]?.trim() || "unknown";
    const verdict = alphaRateLimit(`${ip}:grade`);
    if (!verdict.allow) {
      log('warn', { request_id, ip, retryAfter: verdict.retryAfter }, 'Alpha rate limit exceeded');
      return err("RATE_LIMITED", `Too many requests. Try again in ${verdict.retryAfter}s.`, 429, res);
    }
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      log('error', { request_id }, 'Supabase env not configured');
      return err("ENV_MISSING", "Supabase env not configured", 500, res);
    }

    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      log('error', { request_id }, 'Missing bearer token');
      return err("UNAUTHORIZED", "Missing bearer token", 401, res);
    }
    const token = auth.slice("Bearer ".length);

    const body = (req.body ?? {}) as BodyShape;

    // Section 3: Support both flows
    // - Demo mode (instant grade): requires quiz_id
    // - Section 3 flow (submit attempt): requires attempt_id
    const isDemoMode = process.env.DEMO_INSTANT_GRADE === "true";

    if (!body?.responses) {
      log('error', { request_id }, 'Missing responses');
      return err("BAD_REQUEST", "Missing responses", 400, res);
    }

    if (!body.attempt_id && !body.quiz_id) {
      log('error', { request_id }, 'Missing attempt_id or quiz_id');
      return err("BAD_REQUEST", "Must provide either attempt_id or quiz_id", 400, res);
    }

    // RLS-authenticated Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      log('error', { request_id }, 'Invalid token');
      return err("UNAUTHORIZED", "Invalid or expired token", 401, res);
    }

    const user_id = user.id;

    let quiz_id: string;
    let attempt_id: string;
    let questions: any[];
    let started_at: string | null = null;

    // Section 3: Two flows
    if (body.attempt_id) {
      // Flow 1: Submit existing in_progress attempt
      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, status, started_at, quiz:quizzes(id, questions)")
        .eq("id", body.attempt_id)
        .eq("user_id", user_id)
        .single();

      if (attemptError || !attemptData) {
        log('error', { request_id, user_id, attempt_id: body.attempt_id }, 'Attempt not found or access denied');
        return err("NOT_FOUND", "Attempt not found or access denied", 404, res);
      }

      if (attemptData.status !== "in_progress") {
        log('error', { request_id, user_id, attempt_id: body.attempt_id, status: attemptData.status }, 'Attempt already submitted');
        return err("BAD_REQUEST", "Attempt already submitted", 400, res);
      }

      quiz_id = attemptData.quiz_id;
      attempt_id = attemptData.id;
      started_at = attemptData.started_at;
      questions = Array.isArray((attemptData.quiz as any)?.questions) ? (attemptData.quiz as any).questions : [];

    } else {
      // Flow 2: Demo mode (instant grade) - create new attempt
      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .select("id, questions")
        .eq("id", body.quiz_id!)
        .single();

      if (qErr || !quiz) {
        log('error', { request_id, user_id, quiz_id: body.quiz_id }, 'Quiz not found');
        return err("NOT_FOUND", "Quiz not found", 404, res);
      }

      quiz_id = quiz.id;
      questions = Array.isArray(quiz.questions) ? quiz.questions : [];

      // Create new attempt in submitted state (demo mode - no in_progress phase)
      const { data: newAttempt, error: insertError } = await supabase
        .from("quiz_attempts")
        .insert({
          quiz_id,
          user_id,
          status: "submitted",
          responses: body.responses,
        })
        .select("id, started_at")
        .single();

      if (insertError || !newAttempt) {
        log('error', { request_id, user_id, quiz_id, error: insertError?.message }, 'Failed to create attempt');
        return err("DB_ERROR", insertError?.message || "Failed to create attempt", 400, res);
      }

      attempt_id = newAttempt.id;
      started_at = newAttempt.started_at;
    }

    if (questions.length === 0) {
      log('error', { request_id, user_id, quiz_id }, 'Empty quiz');
      return err("EMPTY_QUIZ", "Quiz has no questions", 400, res);
    }

    // 2) Grade fully (score + per-question feedback + improvements)
    const gradingStartMs = Date.now();
    const result = await gradeSubmission(questions as Question[], body.responses);
    const gradingLatencyMs = Date.now() - gradingStartMs;

    // 3) Update attempt with grading results (atomic transaction)
    // For Section 3: in_progress → submitted transition
    // For demo mode: update the newly created submitted attempt
    const submitted_at = new Date().toISOString();
    const duration_ms = started_at ? Date.now() - new Date(started_at).getTime() : gradingLatencyMs;

    const { data: updatedAttempt, error: updateError } = await supabase
      .from("quiz_attempts")
      .update({
        status: "submitted",
        responses: body.responses,
        score: result.percent / 100, // Store as 0..1 decimal
        grading: result.breakdown,
        submitted_at,
        duration_ms,
        grading_model: "deterministic", // Will become actual model when AI grading implemented
        metrics: {
          tokens_in: null,
          tokens_out: null,
          latency_ms: gradingLatencyMs,
          fallback_happened: false,
        },
      })
      .eq("id", attempt_id)
      .eq("user_id", user_id) // Double-check ownership
      .select("id")
      .single();

    if (updateError) {
      log('error', { request_id, user_id, attempt_id, error: updateError.message }, 'Failed to update attempt with grading');
      return err("DB_ERROR", updateError.message || "Failed to save grading", 400, res);
    }

    log('info', { request_id, user_id, quiz_id, attempt_id, score: result.percent, duration_ms }, 'Grading completed');

    // Calculate letter grade (fix frontend mismatch)
    const letter =
      result.percent >= 90
        ? "A"
        : result.percent >= 80
        ? "B"
        : result.percent >= 70
        ? "C"
        : result.percent >= 60
        ? "D"
        : "F";

    // Count question types for analytics
    const questionTypeBreakdown = {
      mcq: questions.filter((q: any) => q.type === "mcq").length,
      short: questions.filter((q: any) => q.type === "short").length,
      long: questions.filter((q: any) => q.type === "long").length,
    };

    // Fire-and-forget analytics insertion
    // Note: Current grading is deterministic (MCQ exact match, Short fuzzy match)
    // When AI grading is added for long answers, this will use real router metrics
    const routerMetrics: RouterMetrics = {
      request_id,
      model_used: "deterministic", // Will become actual model when AI grading is implemented
      model_family: "standard",
      fallback_triggered: false,
      attempt_count: 1,
      latency_ms: gradingLatencyMs, // Real timing captured above
      tokens_prompt: undefined, // No AI call yet
      tokens_completion: undefined,
      tokens_total: undefined,
    };

    insertGradingAnalytics(
      attempt_id,
      user_id,
      quiz_id,
      routerMetrics,
      [], // Grading results will be populated when AI grading is fully implemented
      questionTypeBreakdown,
      RUBRIC_VERSION
    ).catch((err) => {
      console.error("GRADING_ANALYTICS_INSERT_ERROR", {
        request_id,
        attempt_id,
        error: err?.message || "Unknown error",
      });
    });

    // 4) Respond with rich feedback (not stored in DB to avoid schema changes)
    return res.status(200).json({
      attempt_id,
      score: result.percent,
      letter, // Add letter grade for frontend
      summary: result.summary,
      breakdown: result.breakdown,
    });

  } catch (error: any) {
    log('error', { request_id, error: error.message }, 'Unhandled error');
    return err("INTERNAL_ERROR", error?.message || "Unknown error", 500, res);
  }
}
