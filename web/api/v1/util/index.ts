// Purpose: Unified utility gateway for system operations
// Consolidates: 4 endpoints (ping, health, track, use-tokens) → 1 gateway
// Rate limit: 30 calls/60s (high-traffic utility operations)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../_middleware';
import * as actions from './_actions';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions, {
    requireAuth: false, // ping/health are public, others will check internally
    rateLimit: { calls: 30, window: 60 },
    maxBodySize: 10 * 1024 // 10KB (telemetry payloads)
  });
}
