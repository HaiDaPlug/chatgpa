// Purpose: Debug-only client log shipping to Vercel
// Task C: Ship browser stage logs to Vercel for correlation
// Security: 4KB payload cap, never logs user content (notes/prompts)

import type { GatewayContext } from '../../_types.js';
import { ClientLogInput } from '../_schemas.js';

export async function client_log(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  // Validate input (non-blocking - logs are non-critical)
  const parsed = ClientLogInput.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid payload' };  // Don't throw - logs are non-critical
  }

  const { level, message, source, gen_request_id, data: logData } = parsed.data;
  const { request_id, user_id } = context;

  // Hard cap: prevent huge logs (4KB max)
  // ⚠️ Security: Only timings/stage names/IDs allowed - NEVER note text or prompts
  const safeData = JSON.stringify(logData || {}).slice(0, 4000);

  // Structured log for Vercel Runtime Logs
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      source: source || 'client_log',  // Searchable page/component name
      log_level: level,
      request_id,
      user_id: user_id || 'anonymous',
      gen_request_id: gen_request_id || null,
      message,
      data: safeData,
    })
  );

  return { ok: true };
}
