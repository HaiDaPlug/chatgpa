// Purpose: Fire-and-forget telemetry tracking
// Migrated from: /api/track
// Features: Non-blocking, swallows errors, no auth required

import type { GatewayContext } from '../../_types';
import { TrackInput } from '../schemas';

export async function track(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, ip } = context;

  try {
    // Optional: basic schema guard (non-blocking)
    const parseResult = TrackInput.safeParse(data);
    if (!parseResult.success) {
      // Don't fail telemetry; swallow errors in alpha
      return {};
    }

    const { event, data: eventData } = parseResult.data;

    // Non-blocking telemetry: log or enqueue then end
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        request_id,
        telemetry: event,
        data: eventData ?? {},
        ip,
        message: 'Telemetry event tracked'
      })
    );

    return {};
  } catch (err: any) {
    // Swallow in alpha to avoid breaking UX
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'track',
        error: err?.message || 'Unknown error',
        message: 'Telemetry tracking failed (non-blocking)'
      })
    );
    return {};
  }
}
