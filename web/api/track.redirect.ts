// Purpose: 307 Temporary Redirect for /api/track → /api/v1/util?action=track
// Migration: Phase 5 - Utility Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from './v1/_redirects';

// Redirect to new utility gateway
const newPath = '/api/v1/util?action=track';

export default createLegacyRedirect(newPath);
