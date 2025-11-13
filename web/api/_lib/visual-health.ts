// Purpose: Visual system health diagnostics for /api/v1/util?action=health
// Connects to: unified analytics table, visual telemetry events
// Section 7: Phase 4 - Analytics integration

import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface VisualHealthMetrics {
  visuals_enabled_rate_24h: number;      // % quizzes with visuals enabled (0-1)
  avg_asset_load_ms_24h: number | null;  // Avg load time for assets (null if no data)
  asset_error_rate_24h: number;          // % of asset loads that failed (0-1)
  text_only_mode_users_24h: number;      // Count of users who toggled text-only
  sample_size_24h: number;               // Total visual events in 24h
}

// ============================================================================
// Visual Health Queries
// ============================================================================

/**
 * Query unified analytics for visual system health metrics.
 * Returns aggregate stats for the health endpoint (only when ?details=true).
 *
 * PII Safety: No raw IPs or PII exposed in metrics.
 * Performance: Only called when details requested, keeps cheap path fast.
 */
export async function getVisualHealthMetrics(): Promise<VisualHealthMetrics> {
  // Default metrics (if queries fail)
  const defaultMetrics: VisualHealthMetrics = {
    visuals_enabled_rate_24h: 0,
    avg_asset_load_ms_24h: null,
    asset_error_rate_24h: 0,
    text_only_mode_users_24h: 0,
    sample_size_24h: 0,
  };

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Need service role to aggregate across all users
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.warn("VISUAL_HEALTH_CHECK_SKIPPED", {
        reason: "missing_supabase_config",
      });
      return defaultMetrics;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query 1: Visual enablement rate
    const { data: visualEvents, error: visualError } = await supabase
      .from("analytics")
      .select("event")
      .in("event", ["quiz_visuals_enabled", "quiz_visuals_disabled"])
      .gte("created_at", twentyFourHoursAgo);

    if (visualError) {
      console.error("VISUAL_HEALTH_QUERY_FAILED", {
        query: "visual_enablement",
        error: visualError.message,
      });
    }

    let visualsEnabledRate = 0;
    if (visualEvents && visualEvents.length > 0) {
      const enabledCount = visualEvents.filter((row) => row.event === "quiz_visuals_enabled").length;
      visualsEnabledRate = Math.round((enabledCount / visualEvents.length) * 100) / 100; // 0-1
    }

    // Query 2: Asset load performance
    const { data: assetLoadEvents, error: assetLoadError } = await supabase
      .from("analytics")
      .select("data")
      .in("event", ["asset_load_success", "asset_load_error"])
      .gte("created_at", twentyFourHoursAgo);

    if (assetLoadError) {
      console.error("VISUAL_HEALTH_QUERY_FAILED", {
        query: "asset_load",
        error: assetLoadError.message,
      });
    }

    let avgAssetLoadMs: number | null = null;
    let assetErrorRate = 0;

    if (assetLoadEvents && assetLoadEvents.length > 0) {
      // Calculate avg load time (only from success events with latency_ms)
      const loadTimes = assetLoadEvents
        .filter((row) => (row.data as any)?.latency_ms != null)
        .map((row) => (row.data as any).latency_ms);

      if (loadTimes.length > 0) {
        const sum = loadTimes.reduce((acc: number, ms: number) => acc + ms, 0);
        avgAssetLoadMs = Math.round(sum / loadTimes.length);
      }

      // Calculate error rate
      const errorCount = assetLoadEvents.filter((row) =>
        assetLoadEvents.findIndex((e) => e === row) >= 0 &&
        (row.data as any)?.event === "asset_load_error"
      ).length;
      assetErrorRate = Math.round((errorCount / assetLoadEvents.length) * 100) / 100; // 0-1
    }

    // Query 3: Text-only mode toggles (count distinct users)
    const { data: textOnlyToggles, error: textOnlyError } = await supabase
      .from("analytics")
      .select("user_id, data")
      .eq("event", "text_only_mode_toggled")
      .gte("created_at", twentyFourHoursAgo);

    if (textOnlyError) {
      console.error("VISUAL_HEALTH_QUERY_FAILED", {
        query: "text_only_toggles",
        error: textOnlyError.message,
      });
    }

    // Count distinct users who toggled (with enabled=true)
    let textOnlyUserCount = 0;
    if (textOnlyToggles && textOnlyToggles.length > 0) {
      const uniqueUsers = new Set(
        textOnlyToggles
          .filter((row) => (row.data as any)?.enabled === true)
          .map((row) => row.user_id)
          .filter((id) => id != null)
      );
      textOnlyUserCount = uniqueUsers.size;
    }

    // Total sample size for context
    const totalVisualEvents =
      (visualEvents?.length || 0) +
      (assetLoadEvents?.length || 0) +
      (textOnlyToggles?.length || 0);

    return {
      visuals_enabled_rate_24h: visualsEnabledRate,
      avg_asset_load_ms_24h: avgAssetLoadMs,
      asset_error_rate_24h: assetErrorRate,
      text_only_mode_users_24h: textOnlyUserCount,
      sample_size_24h: totalVisualEvents,
    };
  } catch (err: any) {
    console.error("VISUAL_HEALTH_CHECK_EXCEPTION", {
      error_message: err?.message || "Unknown error",
    });

    // Return default metrics on error (non-blocking)
    return defaultMetrics;
  }
}
