// Purpose: Marketing and growth operations gateway
// Consolidates: 1 endpoint (waitlist from router) → 1 gateway
// Rate limit: 10 calls/60s (public-facing, bot-protected)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../_middleware.js';
import * as actions from './_actions/index.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions, {
    requireAuth: false, // Public endpoint with Turnstile protection
    rateLimit: { calls: 10, window: 60 },
    maxBodySize: 10 * 1024 // 10KB (email + metadata)
  });
}
