// Purpose: Grade a quiz submission, store attempt (RLS), and return score + detailed feedback.
// Error shape: { code, message } only. Uses anon client + user Bearer for RLS.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { gradeSubmission, type Question } from "../src/lib/grader";
import { randomUUID } from "crypto";
import { alphaRateLimit, alphaLimitsEnabled } from "./_lib/alpha-limit.js";

type BodyShape = {
  quiz_id: string;
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
    if (!body?.quiz_id || !body?.responses) {
      log('error', { request_id }, 'Missing quiz_id or responses');
      return err("BAD_REQUEST", "Missing quiz_id or responses", 400, res);
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

    // 1) Fetch quiz questions (RLS enforces ownership)
    const { data: quiz, error: qErr } = await supabase
      .from("quizzes")
      .select("id, questions")
      .eq("id", body.quiz_id)
      .single();

    if (qErr || !quiz) {
      log('error', { request_id, user_id, quiz_id: body.quiz_id }, 'Quiz not found');
      return err("NOT_FOUND", "Quiz not found", 404, res);
    }

    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (questions.length === 0) {
      log('error', { request_id, user_id, quiz_id: body.quiz_id }, 'Empty quiz');
      return err("EMPTY_QUIZ", "Quiz has no questions", 400, res);
    }

    // 2) Grade fully (score + per-question feedback + improvements)
    const result = await gradeSubmission(questions as Question[], body.responses);

    // 3) Insert attempt (RLS)
    const { data: attempt, error: aErr } = await supabase
      .from("quiz_attempts")
      .insert([{
        quiz_id: body.quiz_id,
        responses: body.responses,
        score: result.percent / 100  // Store as 0..1 decimal
      }])
      .select("id")
      .single();

    if (aErr || !attempt) {
      log('error', { request_id, user_id, quiz_id: body.quiz_id, error: aErr?.message }, 'Failed to insert attempt');
      return err("DB_ERROR", aErr?.message || "Failed to save attempt", 400, res);
    }

    log('info', { request_id, user_id, quiz_id: body.quiz_id, attempt_id: attempt.id, score: result.percent }, 'Grading completed');

    // 4) Respond with rich feedback (not stored in DB to avoid schema changes)
    return res.status(200).json({
      attempt_id: attempt.id,
      score: result.percent,
      summary: result.summary,
      breakdown: result.breakdown,
    });

  } catch (error: any) {
    log('error', { request_id, error: error.message }, 'Unhandled error');
    return err("INTERNAL_ERROR", error?.message || "Unknown error", 500, res);
  }
}
