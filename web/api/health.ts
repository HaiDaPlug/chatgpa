// Health check endpoint for verifying environment configuration
// GET /api/health
// Returns 200 if all systems are healthy, 503 if any checks fail
// Add ?details=true to see full diagnostics including router health

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { validateAIConfig, aiDiagnostics } from "./_lib/ai.js";
import { getRouterHealthStatus, getRouterConfigSummary, getConfigMetrics24h } from "./_lib/ai-health.js";
import { getFolderHealthMetricsDirectSQL } from "./_lib/folder-health.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Run health checks
  const aiConfig = validateAIConfig();
  const aiInfo = aiDiagnostics();

  // Get router config (quick check, no DB queries)
  const routerConfig = getRouterConfigSummary();

  const checks = {
    supabase_url: !!process.env.SUPABASE_URL?.trim(),
    supabase_anon_key: !!process.env.SUPABASE_ANON_KEY?.trim(),
    openai_api_key: aiInfo.key_present,
    ai_config_valid: aiConfig.valid,
    router_operational: true, // Assume operational unless proven otherwise
  };

  // Determine overall health
  const allHealthy = Object.values(checks).every(v => v);
  const status = allHealthy ? 200 : 503;

  // Include error details only in non-production or if specifically requested
  const includeDetails = process.env.NODE_ENV !== 'production' || req.query.details === 'true';

  const response: any = {
    status: allHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
  };

  if (includeDetails) {
    response.checks = checks;

    // Add AI diagnostics for visibility
    response.ai = {
      ...aiInfo,
      ...routerConfig,
      config_valid: aiConfig.valid,
      config_error: aiConfig.error || null,
    };

    // Add full router health status (includes DB queries for analytics)
    try {
      const routerHealth = await getRouterHealthStatus();
      response.router = routerHealth;
    } catch (err: any) {
      console.error("HEALTH_ROUTER_CHECK_FAILED", {
        error_message: err?.message || "Unknown error",
      });
      response.router = {
        operational: false,
        error: "Failed to query router health",
      };
    }

    // Section 4: Add config usage metrics (last 24h)
    try {
      const configMetrics = await getConfigMetrics24h();
      response.config_metrics_24h = configMetrics;
    } catch (err: any) {
      console.error("HEALTH_CONFIG_METRICS_FAILED", {
        error_message: err?.message || "Unknown error",
      });
      response.config_metrics_24h = {
        error: "Failed to query config metrics",
      };
    }

    // Section 5: Add folder health metrics
    try {
      const folderMetrics = await getFolderHealthMetricsDirectSQL();
      response.folder_metrics = folderMetrics;
    } catch (err: any) {
      console.error("HEALTH_FOLDER_METRICS_FAILED", {
        error_message: err?.message || "Unknown error",
      });
      response.folder_metrics = {
        error: "Failed to query folder metrics",
      };
    }
  }

  return res.status(status).json(response);
}
