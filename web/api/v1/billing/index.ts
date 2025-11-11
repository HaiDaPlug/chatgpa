// Purpose: Unified billing gateway for Stripe operations
// Consolidates: 2 endpoints (create-checkout-session, portal from router) → 1 gateway
// Rate limit: 10 calls/60s (billing operations)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../_middleware';
import * as actions from './actions';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions, {
    requireAuth: false, // Will check internally per action
    rateLimit: { calls: 10, window: 60 },
    maxBodySize: 10 * 1024 // 10KB (billing payloads are small)
  });
}
