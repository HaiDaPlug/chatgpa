// Purpose: 307 Temporary Redirect for /api/router actions → appropriate gateways
// Migration: Phase 6 - router.ts retirement
// Status: Active during 2-week grace period, then switch to 308, then remove
// Actions:
//   - join-waitlist → /api/v1/marketing?action=join_waitlist
//   - stripe-checkout → /api/v1/billing?action=create_checkout
//   - stripe-portal → /api/v1/billing?action=portal

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from './v1/_redirects';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  let newPath: string;
  switch (action) {
    case 'join-waitlist':
      newPath = '/api/v1/marketing?action=join_waitlist';
      break;
    case 'stripe-checkout':
      newPath = '/api/v1/billing?action=create_checkout';
      break;
    case 'stripe-portal':
      newPath = '/api/v1/billing?action=portal';
      break;
    default:
      return res.status(400).json({
        error: 'Invalid action',
        message: 'Action not found or has been migrated. Check documentation.'
      });
  }

  // Use the standard legacy redirect helper
  return createLegacyRedirect(newPath)(req, res);
}
