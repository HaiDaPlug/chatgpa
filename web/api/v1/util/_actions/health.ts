// Purpose: Comprehensive health check with diagnostics
// Migrated from: /api/health
// Features: Environment validation, AI Router health, folder metrics

import type { GatewayContext } from '../../_types.js';
import { validateAIConfig, aiDiagnostics } from '../../../_lib/ai.js';
import { getRouterHealthStatus, getRouterConfigSummary, getConfigMetrics24h } from '../../../_lib/ai-health.js';
import { getFolderHealthMetricsDirectSQL } from '../../../_lib/folder-health.js';
import { getVisualHealthMetrics } from '../../../_lib/visual-health.js';

export async function health(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, req } = context;

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

  // Include error details only in non-production or if specifically requested
  const includeDetails = process.env.NODE_ENV !== 'production' || req.query.details === 'true';

  const response: any = {
    status: allHealthy ? 'healthy' : 'unhealthy',
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
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          action: 'health',
          error: err?.message || 'Unknown error',
          message: 'Router health check failed'
        })
      );
      response.router = {
        operational: false,
        error: 'Failed to query router health',
      };
    }

    // Section 4: Add config usage metrics (last 24h)
    try {
      const configMetrics = await getConfigMetrics24h();
      response.config_metrics_24h = configMetrics;
    } catch (err: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          action: 'health',
          error: err?.message || 'Unknown error',
          message: 'Config metrics check failed'
        })
      );
      response.config_metrics_24h = {
        error: 'Failed to query config metrics',
      };
    }

    // Section 5: Add folder health metrics
    try {
      const folderMetrics = await getFolderHealthMetricsDirectSQL();
      response.folder_metrics = folderMetrics;

      // Surface warning if duplicate notes detected
      if (folderMetrics.duplicate_notes_detected > 0) {
        if (!response.warnings) response.warnings = [];
        response.warnings.push({
          code: 'DUPLICATE_NOTE_MAPPINGS',
          message: `${folderMetrics.duplicate_notes_detected} note(s) mapped to multiple folders. Check data integrity.`,
          severity: 'WARN',
        });
      }
    } catch (err: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          action: 'health',
          error: err?.message || 'Unknown error',
          message: 'Folder metrics check failed'
        })
      );
      response.folder_metrics = {
        error: 'Failed to query folder metrics',
      };
    }

    // Section 7: Add visual system health metrics
    try {
      const visualMetrics = await getVisualHealthMetrics();
      response.visual_metrics = visualMetrics;

      // Surface warning if high asset error rate
      if (visualMetrics.asset_error_rate_24h > 0.1) {
        if (!response.warnings) response.warnings = [];
        response.warnings.push({
          code: 'HIGH_ASSET_ERROR_RATE',
          message: `Asset load error rate is ${Math.round(visualMetrics.asset_error_rate_24h * 100)}%. Check asset availability.`,
          severity: 'WARN',
        });
      }
    } catch (err: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          action: 'health',
          error: err?.message || 'Unknown error',
          message: 'Visual metrics check failed'
        })
      );
      response.visual_metrics = {
        error: 'Failed to query visual metrics',
      };
    }
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'health',
      status: allHealthy ? 'healthy' : 'unhealthy',
      message: 'Health check completed'
    })
  );

  return response;
}
