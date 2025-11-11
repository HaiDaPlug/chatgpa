// Purpose: Legacy endpoint redirect helpers (307 → 308 → remove)
// Connects to: All legacy API endpoints during migration

import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Track Legacy Route Access (Fire-and-Forget)
 * Logs usage with hashed IP for PII protection
 */
function trackLegacyRoute(
  req: VercelRequest,
  newPath: string,
  user_id?: string
): void {
  try {
    // Hash IP for PII protection (SHA-256, first 16 chars)
    const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0] || 'unknown';
    const hashedIp = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    // Fire-and-forget telemetry
    fetch(`${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'legacy_route_accessed',
        data: {
          old_path: req.url,
          new_path: newPath,
          user_id,
          ip_hash: hashedIp,
          timestamp: new Date().toISOString()
        }
      })
    }).catch(() => {
      // Silent fail (fire-and-forget)
    });
  } catch (err) {
    // Never crash redirect due to telemetry failure
  }
}

/**
 * Create 307 Temporary Redirect (Method-Preserving)
 * Used during 2-week grace period
 * Tracks legacy usage for removal criteria
 */
export function createLegacyRedirect(newPath: string) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Extract user_id from auth header if present
    let user_id: string | undefined;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
        );
        user_id = payload.sub;
      }
    } catch {
      // Ignore parse errors
    }

    // Track usage
    trackLegacyRoute(req, newPath, user_id);

    // 307: Temporary, method-preserving redirect
    res.setHeader('Location', newPath);
    res.status(307).json({
      code: 'LEGACY_ENDPOINT',
      message: `This endpoint has moved to ${newPath}. Please update your client.`
    });
  };
}

/**
 * Create 308 Permanent Redirect (Method-Preserving)
 * Used after 72h of zero legacy hits (before final removal)
 */
export function createPermanentRedirect(newPath: string) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // 308: Permanent, method-preserving redirect
    res.setHeader('Location', newPath);
    res.status(308).json({
      code: 'LEGACY_ENDPOINT',
      message: `This endpoint has permanently moved to ${newPath}.`
    });
  };
}

/**
 * Check Legacy Route Usage (Analytics Query)
 * Returns count of legacy_route_accessed events in last 72 hours
 * Used to determine when it's safe to remove redirects
 *
 * Usage (manual SQL query):
 * ```sql
 * SELECT COUNT(*) FROM analytics
 * WHERE event_type = 'legacy_route_accessed'
 * AND created_at > NOW() - INTERVAL '72 hours';
 * ```
 *
 * If count = 0 for 72h straight → safe to switch to 308
 * If count = 0 for another 72h → safe to remove endpoint
 */
export const REMOVAL_CRITERIA = {
  GRACE_PERIOD_DAYS: 14, // Minimum time before switching to 308
  ZERO_HITS_HOURS: 72, // Required zero-hit window before removal
  ANALYTICS_EVENT: 'legacy_route_accessed'
} as const;
