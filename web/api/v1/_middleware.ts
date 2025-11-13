// Purpose: Core gateway middleware pipeline with auth, rate limiting, routing
// Connects to: All v1 gateway endpoints

import crypto from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  GatewayConfig,
  GatewayContext,
  RateLimitResult,
  RateLimitEntry,
  ActionHandler
} from './_types';

// In-memory rate limit store (per function instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Main Gateway Request Handler
 * Implements full middleware pipeline:
 * 1. Content-Type validation
 * 2. Body size check
 * 3. Request ID enforcement
 * 4. Auth check (if required)
 * 5. Rate limiting
 * 6. Action routing
 * 7. Execution + response envelope
 */
export async function handleGatewayRequest(
  req: VercelRequest,
  res: VercelResponse,
  actions: Record<string, ActionHandler>,
  config: GatewayConfig = {}
): Promise<VercelResponse | void> {
  const startTime = Date.now();

  // 1. Content-Type validation (POST requests only)
  if (req.method === 'POST') {
    const contentType = req.headers['content-type'];
    if (contentType !== 'application/json') {
      return res.status(415).json({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type must be application/json'
      });
    }
  }

  // 2. Body size check (uniform 1MB cap)
  const maxSize = config.maxBodySize || 1024 * 1024; // 1MB default
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > maxSize) {
    return res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message: `Request body exceeds ${maxSize} bytes`
    });
  }

  // 3. Request ID enforcement (auto-generate if missing)
  const request_id = (req.body?.request_id as string) || crypto.randomUUID();
  res.setHeader('X-Request-ID', request_id);

  // 4. Auth check (unless explicitly bypassed)
  let token: string | undefined;
  let user_id: string | undefined;

  if (config.requireAuth !== false) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log('warn', { request_id, route: req.url }, 'Missing or invalid auth header');
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authorization: Bearer <token> header required'
      });
    }

    token = authHeader.substring(7);

    // Extract user_id from JWT (Supabase token)
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
      );
      user_id = payload.sub;
    } catch (err) {
      log('warn', { request_id, route: req.url }, 'Invalid JWT format');
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid token format'
      });
    }
  }

  // 5. Rate limiting (in-memory sliding window)
  if (config.rateLimit) {
    const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0] || 'unknown';
    const rateLimitKey = `${user_id || ip}:${req.url}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, config.rateLimit);

    if (!rateLimitResult.allow) {
      log(
        'info',
        { request_id, user_id, route: req.url },
        `Rate limit exceeded (retry after ${rateLimitResult.retryAfter}s)`
      );

      // Track rate limit hit (fire-and-forget)
      trackRateLimitHit(req, user_id);

      return res.status(429).json({
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds`,
        retryAfter: rateLimitResult.retryAfter
      });
    }
  }

  // 6. Route to action
  const action = (req.query.action as string) || (req.body?.action as string);
  if (!action) {
    log('warn', { request_id, route: req.url }, 'Missing action parameter');
    return res.status(400).json({
      code: 'ACTION_UNKNOWN',
      message: 'Missing action parameter in query or body'
    });
  }

  const handler = actions[action];
  if (!handler) {
    log('warn', { request_id, action, route: req.url }, 'Unknown action');
    return res.status(400).json({
      code: 'ACTION_UNKNOWN',
      message: `Unknown action: ${action}`
    });
  }

  // 7. Execute action
  const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0] || 'unknown';
  const context: GatewayContext = {
    request_id,
    token,
    user_id,
    ip, // Raw IP for RLS/internal use (not logged)
    req,
    res
  };

  try {
    const data = req.body?.data || req.body || {};
    const result = await handler(data, context);

    const latency = Date.now() - startTime;
    log('info', { request_id, action, latency, user_id }, 'Action completed');

    return res.status(200).json({
      ok: true,
      data: result,
      request_id
    });
  } catch (error: any) {
    const latency = Date.now() - startTime;
    log(
      'error',
      { request_id, action, latency, error: error.message, user_id },
      'Action failed'
    );

    // Check if error has structured shape { code, message, status? }
    if (error.code && error.message) {
      const status = error.status || 500;
      const response: any = {
        code: error.code,
        message: error.message
      };

      // Include retryAfter for rate limit errors
      if (error.retryAfter) {
        response.retryAfter = error.retryAfter;
      }

      return res.status(status).json(response);
    }

    // Fallback: generic server error
    return res.status(500).json({
      code: 'SERVER_ERROR',
      message: error.message || 'Internal server error'
    });
  }
}

/**
 * Clock-Safe Rate Limiter
 * Uses Date.now() only (no system time dependencies)
 * Sliding window per function instance (resets on cold start)
 */
function checkRateLimit(
  key: string,
  config: { calls: number; window: number }
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { timestamps: [] };

  // Remove old timestamps (outside window)
  entry.timestamps = entry.timestamps.filter(ts => now - ts < config.window * 1000);

  // Check if limit exceeded
  if (entry.timestamps.length >= config.calls) {
    const oldestTs = entry.timestamps[0];
    const retryAfter = Math.ceil((oldestTs + config.window * 1000 - now) / 1000);
    return { allow: false, retryAfter };
  }

  // Allow request + record timestamp
  entry.timestamps.push(now);
  rateLimitStore.set(key, entry);
  return { allow: true };
}

/**
 * Structured Logging
 * JSON format for log aggregation (Vercel, CloudWatch, etc.)
 */
function log(level: 'info' | 'warn' | 'error', context: any, message: string): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      ...context,
      message
    })
  );
}

/**
 * Track Rate Limit Hit (Fire-and-Forget)
 * Will be connected to telemetry gateway in Phase 5
 */
function trackRateLimitHit(req: VercelRequest, user_id?: string): void {
  // Hash IP for PII protection
  const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0] || 'unknown';
  const hashedIp = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

  // Fire-and-forget (no await)
  // TODO: Phase 5 - connect to /api/v1/telemetry
  fetch(`${process.env.VITE_APP_URL || 'http://localhost:3000'}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'rate_limit_hit',
      data: {
        action: req.query.action || 'unknown',
        user_id,
        ip_hash: hashedIp,
        route: req.url
      }
    })
  }).catch(() => {
    // Silent fail (fire-and-forget)
  });
}
