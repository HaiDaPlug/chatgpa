// Purpose: Router health diagnostics for /api/health endpoint
// Connects to: generation_analytics table, ai-router

import { createClient } from "@supabase/supabase-js";
import { detectModelFamily } from "./ai-router.js";

// ============================================================================
// Types
// ============================================================================

export interface RouterHealthStatus {
  operational: boolean;
  default_model: string;
  default_model_family: string;
  fallback_model: string;
  fallback_model_family: string;
  fallback_enabled: boolean;
  recent_fallbacks_5m: number;
  last_fallback_at?: string;
  last_fallback_reason?: string;
  avg_latency_ms_24h?: number;
  success_rate_24h?: number;
}

// ============================================================================
// Configuration Helpers
// ============================================================================

function getRouterConfig() {
  const defaultModel = process.env.OPENAI_MODEL_GENERATE_DEFAULT || "gpt-4o-mini";
  const fallbackModel = process.env.OPENAI_MODEL_GENERATE_FALLBACK || "gpt-5-mini";
  const fallbackEnabled = (process.env.ROUTER_ENABLE_FALLBACK || "true") === "true";

  return {
    defaultModel,
    defaultModelFamily: detectModelFamily(defaultModel),
    fallbackModel,
    fallbackModelFamily: detectModelFamily(fallbackModel),
    fallbackEnabled,
  };
}

// ============================================================================
// Analytics Queries
// ============================================================================

/**
 * Query generation_analytics for router health metrics.
 * Returns aggregate stats for the health endpoint.
 */
export async function getRouterHealthStatus(): Promise<RouterHealthStatus> {
  const config = getRouterConfig();

  // Default health status (if queries fail)
  const defaultStatus: RouterHealthStatus = {
    operational: true, // Assume operational unless proven otherwise
    default_model: config.defaultModel,
    default_model_family: config.defaultModelFamily,
    fallback_model: config.fallbackModel,
    fallback_model_family: config.fallbackModelFamily,
    fallback_enabled: config.fallbackEnabled,
    recent_fallbacks_5m: 0,
  };

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Need service role to aggregate across all users
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn("ROUTER_HEALTH_CHECK_SKIPPED", {
        reason: "missing_supabase_config",
      });
      return defaultStatus;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Query 1: Count recent fallbacks (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentFallbacks, error: recentError } = await supabase
      .from("generation_analytics")
      .select("created_at, model_used, error_code")
      .eq("fallback_triggered", true)
      .gte("created_at", fiveMinutesAgo)
      .order("created_at", { ascending: false });

    if (recentError) {
      console.error("ROUTER_HEALTH_QUERY_FAILED", {
        query: "recent_fallbacks",
        error: recentError.message,
      });
    }

    const recentFallbackCount = recentFallbacks?.length || 0;

    // Extract last fallback details
    let lastFallbackAt: string | undefined;
    let lastFallbackReason: string | undefined;
    if (recentFallbacks && recentFallbacks.length > 0) {
      lastFallbackAt = recentFallbacks[0].created_at;
      lastFallbackReason = recentFallbacks[0].error_code || "unknown";
    }

    // Query 2: Calculate avg latency (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: latencyData, error: latencyError } = await supabase
      .from("generation_analytics")
      .select("latency_ms")
      .gte("created_at", twentyFourHoursAgo)
      .not("latency_ms", "is", null);

    if (latencyError) {
      console.error("ROUTER_HEALTH_QUERY_FAILED", {
        query: "avg_latency",
        error: latencyError.message,
      });
    }

    let avgLatency: number | undefined;
    if (latencyData && latencyData.length > 0) {
      const sum = latencyData.reduce((acc, row) => acc + (row.latency_ms || 0), 0);
      avgLatency = Math.round(sum / latencyData.length);
    }

    // Query 3: Calculate success rate (last 24 hours)
    const { data: allAttempts, error: successError } = await supabase
      .from("generation_analytics")
      .select("error_occurred")
      .gte("created_at", twentyFourHoursAgo);

    if (successError) {
      console.error("ROUTER_HEALTH_QUERY_FAILED", {
        query: "success_rate",
        error: successError.message,
      });
    }

    let successRate: number | undefined;
    if (allAttempts && allAttempts.length > 0) {
      const successCount = allAttempts.filter((row) => !row.error_occurred).length;
      successRate = Math.round((successCount / allAttempts.length) * 100) / 100; // 0-1
    }

    return {
      operational: true,
      default_model: config.defaultModel,
      default_model_family: config.defaultModelFamily,
      fallback_model: config.fallbackModel,
      fallback_model_family: config.fallbackModelFamily,
      fallback_enabled: config.fallbackEnabled,
      recent_fallbacks_5m: recentFallbackCount,
      last_fallback_at: lastFallbackAt,
      last_fallback_reason: lastFallbackReason,
      avg_latency_ms_24h: avgLatency,
      success_rate_24h: successRate,
    };
  } catch (err: any) {
    console.error("ROUTER_HEALTH_CHECK_EXCEPTION", {
      error_message: err?.message || "Unknown error",
    });

    // Return default status on error
    return defaultStatus;
  }
}

/**
 * Query grading fallbacks (last 5 minutes).
 * Returns count of recent grading fallbacks for health diagnostics.
 */
export async function getGradingFallbackCount(): Promise<number> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return 0;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Query analytics table for grading events with fallback_triggered
    const { data, error } = await supabase
      .from("analytics")
      .select("created_at")
      .in("event", ["grade_success", "grade_fail"])
      .eq("data->>fallback_triggered", "true")
      .gte("created_at", fiveMinutesAgo);

    if (error) {
      console.error("GRADING_FALLBACK_QUERY_FAILED", {
        error: error.message,
      });
      return 0;
    }

    return data?.length || 0;
  } catch (err) {
    console.error("GRADING_FALLBACK_QUERY_EXCEPTION", {
      error_message: (err as any)?.message || "Unknown error",
    });
    return 0;
  }
}

/**
 * Quick operational check (no database queries).
 * Used when health endpoint is called without ?details=true.
 */
export function getRouterConfigSummary() {
  const config = getRouterConfig();

  // Grading model defaults
  const gradeMcqDefault = process.env.OPENAI_MODEL_GRADE_DEFAULT_MCQ || "gpt-4o-mini";
  const gradeShortDefault = process.env.OPENAI_MODEL_GRADE_DEFAULT_SHORT || "gpt-4o-mini";
  const gradeLongDefault = process.env.OPENAI_MODEL_GRADE_DEFAULT_LONG || "gpt-5-mini";
  const gradeMcqFallback = process.env.OPENAI_MODEL_GRADE_FALLBACK_MCQ || "gpt-5-mini";
  const gradeShortFallback = process.env.OPENAI_MODEL_GRADE_FALLBACK_SHORT || "gpt-5-mini";
  const gradeLongFallback = process.env.OPENAI_MODEL_GRADE_FALLBACK_LONG || "gpt-4o-mini";

  return {
    // Generation config
    default_model: config.defaultModel,
    default_model_family: config.defaultModelFamily,
    fallback_chain: [config.defaultModel, config.fallbackModel],
    fallback_enabled: config.fallbackEnabled,

    // Grading config
    default_model_grade_mcq: gradeMcqDefault,
    default_model_grade_short: gradeShortDefault,
    default_model_grade_long: gradeLongDefault,
    fallback_model_grade_mcq: gradeMcqFallback,
    fallback_model_grade_short: gradeShortFallback,
    fallback_model_grade_long: gradeLongFallback,
  };
}
