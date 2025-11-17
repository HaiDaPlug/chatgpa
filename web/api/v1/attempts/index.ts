// Purpose: Attempts Gateway - Consolidates attempts lifecycle endpoints
// Actions: start, autosave, update_meta
// Rate limit: 10 calls per 10 seconds per user

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../_middleware.js';
import * as actions from './_actions/index.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions, {
    requireAuth: true, // All attempts actions require authentication
    rateLimit: {
      calls: 10,
      window: 10 // 10 calls per 10 seconds (autosave-friendly)
    },
    maxBodySize: 500 * 1024 // 500KB limit for autosave payloads
  });
}
