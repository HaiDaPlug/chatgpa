// Purpose: 307 Temporary Redirect for /api/folders/tree → /api/v1/workspace?action=folder_tree
// Migration: Phase 4 - Workspace Gateway Consolidation
// Status: Active during 2-week grace period, then switch to 308, then remove

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createLegacyRedirect } from '../v1/_redirects';

// Redirect to new workspace gateway
const newPath = '/api/v1/workspace?action=folder_tree';

export default createLegacyRedirect(newPath);
