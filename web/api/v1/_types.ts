// Purpose: Shared type definitions for API gateway system
// Connects to: All v1 gateway endpoints

/**
 * Gateway Request Envelope
 * Standard shape for all gateway requests
 */
export interface GatewayRequest<T = any> {
  action: string;
  data: T;
  request_id?: string; // Optional, auto-generated if missing
}

/**
 * Gateway Response Envelope
 * Standard shape for all successful gateway responses
 */
export interface GatewayResponse<T = any> {
  ok: true;
  data: T;
  request_id: string;
}

/**
 * Gateway Error Response
 * Standard shape for all error responses (non-200 status)
 */
export interface GatewayError {
  code: string;
  message: string;
  retryAfter?: number; // Seconds (for RATE_LIMITED errors)
}

/**
 * Gateway Context
 * Passed to all action handlers for auth, logging, and request metadata
 */
export interface GatewayContext {
  request_id: string;
  token?: string; // JWT access token (if authenticated)
  user_id?: string; // Extracted from JWT sub claim
  ip?: string; // Client IP (hashed for telemetry)
  req: any; // Vercel/Next request object
  res: any; // Vercel/Next response object
}

/**
 * Action Handler Signature
 * All gateway actions implement this interface
 */
export type ActionHandler<TInput = any, TOutput = any> = (
  data: TInput,
  context: GatewayContext
) => Promise<TOutput>;

/**
 * Gateway Configuration
 * Per-gateway settings for middleware pipeline
 */
export interface GatewayConfig {
  requireAuth?: boolean; // Default: true (set false for webhook endpoints)
  rateLimit?: {
    calls: number; // Max calls per window
    window: number; // Time window in seconds
  };
  maxBodySize?: number; // Max request body size in bytes (default: 1MB)
}

/**
 * Rate Limit Result
 * Returned by in-memory rate limiter
 */
export interface RateLimitResult {
  allow: boolean;
  retryAfter?: number; // Seconds until next allowed request
}

/**
 * Rate Limit Store Entry
 * In-memory sliding window tracking
 */
export interface RateLimitEntry {
  timestamps: number[]; // Array of Date.now() timestamps
}
