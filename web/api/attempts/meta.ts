/**
 * PATCH /api/attempts/meta
 * Purpose: Update attempt title and/or subject (inline editing)
 * Section 3: Results Page (Ongoing | Results)
 *
 * Features:
 * - Editable title and subject
 * - Increments autosave_version for consistency with conflict resolution
 * - updated_at auto-touched by DB trigger
 * - Works for both in_progress and submitted attempts
 *
 * Auth: Bearer token (RLS-enabled)
 * Errors: { code, message }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { randomUUID } from "crypto";

// Input schema (at least one of title or subject must be provided)
const Body = z
  .object({
    attempt_id: z.string().uuid(),
    title: z.string().trim().min(1).max(100).optional(),
    subject: z.string().trim().min(1).max(50).optional(),
  })
  .refine((data) => data.title !== undefined || data.subject !== undefined, {
    message: "At least one of title or subject must be provided",
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

  if (req.method !== "PATCH") {
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED", message: "Only PATCH allowed" });
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
          route: "/api/attempts/meta",
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
      log("error", { request_id, route: "/api/attempts/meta" }, "Missing auth header");
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
      log("error", { request_id, route: "/api/attempts/meta" }, "Invalid token");
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
          route: "/api/attempts/meta",
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

    const { attempt_id, title, subject } = parse.data;

    // Verify attempt exists and user owns it (RLS will enforce this)
    const { data: attemptData, error: fetchError } = await supabase
      .from("quiz_attempts")
      .select("id, autosave_version, title, subject")
      .eq("id", attempt_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !attemptData) {
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/meta",
          user_id,
          attempt_id,
        },
        "Attempt not found or access denied"
      );
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Attempt not found or access denied",
      });
    }

    // Build update object (only update provided fields)
    const updates: any = {
      autosave_version: attemptData.autosave_version + 1, // Bump version for consistency
    };

    if (title !== undefined) {
      updates.title = title;
    }

    if (subject !== undefined) {
      updates.subject = subject;
    }

    // Update attempt metadata
    // Note: updated_at is auto-touched by the DB trigger
    const { data: updatedAttempt, error: updateError } = await supabase
      .from("quiz_attempts")
      .update(updates)
      .eq("id", attempt_id)
      .eq("user_id", user_id) // Double-check ownership (RLS should handle this)
      .select("id, title, subject, autosave_version, updated_at")
      .single();

    if (updateError) {
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/meta",
          user_id,
          attempt_id,
          error: updateError.message,
          error_code: updateError.code,
        },
        "Failed to update attempt metadata"
      );
      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Failed to update attempt metadata",
      });
    }

    log(
      "info",
      {
        request_id,
        route: "/api/attempts/meta",
        user_id,
        attempt_id,
        old_title: attemptData.title,
        new_title: updatedAttempt.title,
        old_subject: attemptData.subject,
        new_subject: updatedAttempt.subject,
        autosave_version: updatedAttempt.autosave_version,
      },
      "Metadata updated successfully"
    );

    return res.status(200).json({
      ok: true,
      title: updatedAttempt.title,
      subject: updatedAttempt.subject,
      autosave_version: updatedAttempt.autosave_version,
      updated_at: updatedAttempt.updated_at,
    });
  } catch (error: any) {
    log(
      "error",
      {
        request_id,
        route: "/api/attempts/meta",
        error_message: error.message,
        error_stack: error.stack?.split("\n").slice(0, 3).join(" | "),
      },
      "Unhandled error in attempts/meta"
    );

    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
