// Purpose: 307 Temporary Redirect for /api/grade → /api/v1/ai?action=grade
// Migration: Phase 2 - AI Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from './v1/_redirects';

// Redirect to new AI gateway
const newPath = '/api/v1/ai?action=grade';

export default createLegacyRedirect(newPath);
