// Purpose: 307 Temporary Redirect for /api/classes/notes-uncategorized → /api/v1/workspace?action=notes_uncategorized
// Migration: Phase 5 - Workspace Gateway Extension
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from '../v1/_redirects';

// Redirect to workspace gateway
const newPath = '/api/v1/workspace?action=notes_uncategorized';

export default createLegacyRedirect(newPath);
