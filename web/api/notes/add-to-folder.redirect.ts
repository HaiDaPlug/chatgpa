// Purpose: 307 Temporary Redirect for /api/notes/add-to-folder → /api/v1/workspace?action=note_add_to_folder
// Migration: Phase 4 - Workspace Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from '../v1/_redirects';

// Redirect to new workspace gateway
const newPath = '/api/v1/workspace?action=note_add_to_folder';

export default createLegacyRedirect(newPath);
