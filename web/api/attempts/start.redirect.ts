// Purpose: 307 Temporary Redirect for /api/attempts/start → /api/v1/attempts?action=start
// Migration: Phase 3 - Attempts Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from '../v1/_redirects';

// Redirect to new attempts gateway
const newPath = '/api/v1/attempts?action=start';

export default createLegacyRedirect(newPath);
