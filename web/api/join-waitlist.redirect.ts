// Purpose: 307 Temporary Redirect for /api/join-waitlist → /api/v1/marketing?action=join_waitlist
// Migration: Phase 6 - Marketing Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from './v1/_redirects';

// Redirect to new marketing gateway
const newPath = '/api/v1/marketing?action=join_waitlist';

export default createLegacyRedirect(newPath);
