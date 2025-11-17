// Purpose: Simple health check ping
// Migrated from: /api/ping
// Features: No auth required, instant response

import type { GatewayContext } from '../../_types.js';

export async function ping(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  return {
    ok: true,
    t: Date.now(),
  };
}
