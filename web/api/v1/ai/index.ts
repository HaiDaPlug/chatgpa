// Purpose: AI Gateway - Consolidates generate-quiz, grade, and AI health endpoints
// Actions: generate_quiz, grade, health
// Rate limit: 6 calls per 30 seconds per user

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleGatewayRequest } from '../_middleware';
import * as actions from './actions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleGatewayRequest(req, res, actions, {
    requireAuth: true, // All AI actions require authentication
    rateLimit: {
      calls: 6,
      window: 30 // 6 calls per 30 seconds
    },
    maxBodySize: 1024 * 1024 // 1MB limit for quiz generation payloads
  });
}
