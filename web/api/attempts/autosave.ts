/**
 * PATCH /api/attempts/autosave
 * Purpose: Autosave user answers to an in_progress attempt
 * Section 3: Results Page (Ongoing | Results)
 *
 * Features:
 * - Request size limit (500KB) to prevent abuse
 * - Increments autosave_version for conflict resolution
 * - updated_at auto-touched by DB trigger
 * - Fire-and-forget from client (non-blocking)
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
  attempt_id: z.string().uuid(),
  responses: z.record(z.string()), // { questionId: userAnswer }
});

// Max payload size: 500KB (in bytes)
const MAX_PAYLOAD_SIZE = 500 * 1024;

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
    // Check payload size (prevent large autosaves from bloating DB)
    const bodyString = JSON.stringify(req.body);
    if (Buffer.byteLength(bodyString, "utf8") > MAX_PAYLOAD_SIZE) {
      log(
        "warn",
        {
          request_id,
          route: "/api/attempts/autosave",
          payload_size: Buffer.byteLength(bodyString, "utf8"),
          max_size: MAX_PAYLOAD_SIZE,
        },
        "Payload too large"
      );

      return res.status(413).json({
        code: "PAYLOAD_TOO_LARGE",
        message: `Autosave payload exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024}KB`,
      });
    }

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
          route: "/api/attempts/autosave",
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
      log("error", { request_id, route: "/api/attempts/autosave" }, "Missing auth header");
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
      log("error", { request_id, route: "/api/attempts/autosave" }, "Invalid token");
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
          route: "/api/attempts/autosave",
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

    const { attempt_id, responses } = parse.data;

    // Verify attempt exists, is in_progress, and user owns it (RLS will enforce this)
    const { data: attemptData, error: fetchError } = await supabase
      .from("quiz_attempts")
      .select("id, status, autosave_version")
      .eq("id", attempt_id)
      .eq("user_id", user_id)
      .eq("status", "in_progress")
      .single();

    if (fetchError || !attemptData) {
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/autosave",
          user_id,
          attempt_id,
        },
        "Attempt not found, already submitted, or access denied"
      );
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Attempt not found, already submitted, or access denied",
      });
    }

    // Update attempt with new responses and increment autosave_version
    // Note: updated_at is auto-touched by the DB trigger
    const { data: updatedAttempt, error: updateError } = await supabase
      .from("quiz_attempts")
      .update({
        responses,
        autosave_version: attemptData.autosave_version + 1,
      })
      .eq("id", attempt_id)
      .eq("user_id", user_id) // Double-check ownership (RLS should handle this)
      .select("id, autosave_version, updated_at")
      .single();

    if (updateError) {
      log(
        "error",
        {
          request_id,
          route: "/api/attempts/autosave",
          user_id,
          attempt_id,
          error: updateError.message,
          error_code: updateError.code,
        },
        "Failed to autosave attempt"
      );
      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Failed to autosave attempt",
      });
    }

    log(
      "info",
      {
        request_id,
        route: "/api/attempts/autosave",
        user_id,
        attempt_id,
        autosave_version: updatedAttempt.autosave_version,
        response_count: Object.keys(responses).length,
      },
      "Autosave successful"
    );

    return res.status(200).json({
      ok: true,
      autosave_version: updatedAttempt.autosave_version,
      updated_at: updatedAttempt.updated_at,
    });
  } catch (error: any) {
    log(
      "error",
      {
        request_id,
        route: "/api/attempts/autosave",
        error_message: error.message,
        error_stack: error.stack?.split("\n").slice(0, 3).join(" | "),
      },
      "Unhandled error in attempts/autosave"
    );

    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
