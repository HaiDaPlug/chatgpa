// Purpose: AI Router health diagnostics (gateway action)
// Provides: Router config, recent fallbacks, 24h metrics

import type { GatewayContext } from '../../_types';
import { getRouterHealthStatus } from '../../../_lib/ai-health';

/**
 * Health Action
 * Returns AI Router health diagnostics
 * Shows: Config, recent fallbacks, 24h generation/grading metrics
 */
export async function health(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id } = context;

  try {
    // Get comprehensive health status from ai-health lib
    const healthStatus = await getRouterHealthStatus();

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        request_id,
        action: 'health',
        operational: healthStatus.operational,
        message: 'Health check completed'
      })
    );

    return healthStatus;
  } catch (error: any) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'health',
        error: error.message,
        message: 'Health check failed'
      })
    );

    // Return degraded status on error (non-blocking)
    return {
      operational: false,
      default_model: 'unknown',
      default_model_family: 'unknown',
      fallback_model: 'unknown',
      fallback_model_family: 'unknown',
      fallback_enabled: false,
      recent_fallbacks_5m: 0
    };
  }
}
