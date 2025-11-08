/**
 * POST /api/attempts/start
 * Purpose: Create a new in_progress attempt for a quiz
 * Section 3: Results Page (Ongoing | Results)
 *
 * Features:
 * - Idempotent (handles double-clicks gracefully)
 * - Enforces one in_progress attempt per quiz/user (via DB constraint)
 * - Copies quiz title/subject → attempt title/subject
 * - Returns attempt ID for routing to /attempts/:id
 *
 * Auth: Bearer token (RLS-enabled)
 * Errors: { code, message }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";

// Input schema
const Body = z.object({
  quiz_id: z.string().uuid(),
  idempotency_key: z.string().uuid().optional(), // Optional: for handling double-clicks
});

// Structured logging
function log(level: "info" | "error" | "warn", context: any, message: string) {
  console.log(
    JSON.stringify({ timestamp: new Date().toISOString(), level, ...context, message })
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const request_id = randomUUID();

  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Only POST allowed" });
  }

  try {
    // Validate environment variables
    const requiredEnvVars = {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value?.trim())
      .map(([key]) => key);

    if (missingVars.length > 0) {
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/start",
          missing_vars: missingVars,
        },
        "Missing required environment variables"
      );

      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Service configuration error",
      });
    }

    // Auth passthrough (RLS relies on this token)
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      log("error", { request_id, route: "/api/attempts/start" }, "Missing auth header");
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Missing or invalid authorization header",
      });
    }

    const access_token = auth.split(" ")[1];

    // Supabase client bound to user token (enables RLS)
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${access_token}` } },
      auth: { persistSession: false },
    });

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      log("error", { request_id, route: "/api/attempts/start" }, "Invalid token");
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }

    const user_id = user.id;

    // Validate body
    const parse = Body.safeParse(req.body ?? {});
    if (!parse.success) {
      const firstError = parse.error.issues[0];
      const errorMsg = firstError?.message ?? "Invalid request body";
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/start",
          user_id,
          validation_error: errorMsg,
        },
        "Schema validation failed"
      );
      return res.status(400).json({
        code: "SCHEMA_INVALID",
        message: errorMsg,
      });
    }

    const { quiz_id, idempotency_key } = parse.data;

    // Check if quiz exists and user has access (RLS handles this)
    const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("id, class_id, title, subject")
      .eq("id", quiz_id)
      .single();

    if (quizError || !quizData) {
      log(
        "error",
        { request_id, route: "/api/attempts/start", user_id, quiz_id },
        "Quiz not found or access denied"
      );
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Quiz not found or access denied",
      });
    }

    // Check for existing in_progress attempt (idempotency)
    // The DB unique index will enforce this, but we check first for a cleaner response
    const { data: existingAttempt, error: checkError } = await supabase
      .from("quiz_attempts")
      .select("id, status, title, subject, started_at, updated_at, autosave_version")
      .eq("quiz_id", quiz_id)
      .eq("user_id", user_id)
      .eq("status", "in_progress")
      .maybeSingle(); // Use maybeSingle() to avoid error if no rows

    if (existingAttempt) {
      // Return existing attempt (idempotent behavior)
      log(
        "info",
        {
          request_id,
          route: "/api/attempts/start",
          user_id,
          quiz_id,
          attempt_id: existingAttempt.id,
          idempotent: true,
        },
        "Returning existing in_progress attempt"
      );

      return res.status(200).json({
        attempt_id: existingAttempt.id,
        status: "in_progress",
        title: existingAttempt.title,
        subject: existingAttempt.subject,
        started_at: existingAttempt.started_at,
        updated_at: existingAttempt.updated_at,
        autosave_version: existingAttempt.autosave_version,
        resumed: true, // Flag indicating this is a resume, not a new start
      });
    }

    // Create new in_progress attempt
    // Copy title/subject from quiz (user can edit later)
    const { data: attemptData, error: insertError } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id,
        user_id,
        class_id: quizData.class_id,
        title: quizData.title || `Quiz Attempt — ${new Date().toLocaleDateString()}`,
        subject: quizData.subject || "General",
        status: "in_progress",
        responses: {}, // Empty responses initially
        autosave_version: 0,
      })
      .select("id, status, title, subject, started_at, updated_at, autosave_version")
      .single();

    if (insertError) {
      // Check if error is due to unique constraint (race condition)
      if (insertError.code === "23505") {
        // Unique constraint violation - another request created it first
        // Try fetching the existing attempt
        const { data: racedAttempt } = await supabase
          .from("quiz_attempts")
          .select("id, status, title, subject, started_at, updated_at, autosave_version")
          .eq("quiz_id", quiz_id)
          .eq("user_id", user_id)
          .eq("status", "in_progress")
          .single();

        if (racedAttempt) {
          log(
            "info",
            {
              request_id,
              route: "/api/attempts/start",
              user_id,
              quiz_id,
              attempt_id: racedAttempt.id,
              race_condition: true,
            },
            "Race condition detected, returning existing attempt"
          );

          return res.status(200).json({
            attempt_id: racedAttempt.id,
            status: "in_progress",
            title: racedAttempt.title,
            subject: racedAttempt.subject,
            started_at: racedAttempt.started_at,
            updated_at: racedAttempt.updated_at,
            autosave_version: racedAttempt.autosave_version,
            resumed: true,
          });
        }
      }

      // Other insert errors
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/start",
          user_id,
          quiz_id,
          error: insertError.message,
          error_code: insertError.code,
        },
        "Failed to create attempt"
      );
      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Failed to create attempt",
      });
    }

    log(
      "info",
      {
        request_id,
        route: "/api/attempts/start",
        user_id,
        quiz_id,
        attempt_id: attemptData.id,
      },
      "Attempt created successfully"
    );

    return res.status(201).json({
      attempt_id: attemptData.id,
      status: "in_progress",
      title: attemptData.title,
      subject: attemptData.subject,
      started_at: attemptData.started_at,
      updated_at: attemptData.updated_at,
      autosave_version: attemptData.autosave_version,
      resumed: false, // New attempt, not a resume
    });
  } catch (error: any) {
    log(
      "error",
      {
        request_id,
        route: "/api/attempts/start",
        error_message: error.message,
        error_stack: error.stack?.split("\n").slice(0, 3).join(" | "),
      },
      "Unhandled error in attempts/start"
    );

    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
