// Purpose: 307 Temporary Redirect for /api/create-checkout-session → /api/v1/billing?action=create_checkout
// Migration: Phase 6 - Billing Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from './v1/_redirects';

// Redirect to new billing gateway
const newPath = '/api/v1/billing?action=create_checkout';

export default createLegacyRedirect(newPath);
