// Purpose: Unified workspace gateway for folders + notes management
// Consolidates: 9 endpoints (7 folders + 2 notes) → 1 gateway
// Rate limit: 20 calls/10s (high-traffic for folder tree operations)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../_middleware.js';
import * as actions from './_actions';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions, {
    requireAuth: true,
    rateLimit: { calls: 20, window: 10 },
    maxBodySize: 100 * 1024 // 100KB (folder names, note mappings)
  });
}
