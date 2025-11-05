// Purpose: Minimal per-user+event sliding window limiter
// Alpha-only, opt-in via ENABLE_ALPHA_LIMITS env var
// Usage: alphaRateLimit(key) returns { allow: true } or { allow: false, retryAfter: number }

type Entry = { ts: number };
const mem: Record<string, Entry[]> = {};
const WINDOW_MS = 30_000;   // 30s window
const MAX_CALLS = 6;        // 6 calls / 30s

/**
 * Check if request should be allowed based on rate limit
 * @param key - Unique identifier for rate limit bucket (e.g., "user_id:endpoint")
 * @returns { allow: true } or { allow: false, retryAfter: number }
 */
export function alphaRateLimit(key: string): { allow: true } | { allow: false; retryAfter: number } {
  const now = Date.now();

  // Clean old entries outside the window
  mem[key] = (mem[key] || []).filter(e => now - e.ts <= WINDOW_MS);

  // Check if limit exceeded
  if (mem[key].length >= MAX_CALLS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - mem[key][0].ts)) / 1000);
    return { allow: false, retryAfter };
  }

  // Record this call
  mem[key].push({ ts: now });
  return { allow: true };
}

/**
 * Check if alpha limits are enabled via environment variable
 * @returns boolean
 */
export function alphaLimitsEnabled(): boolean {
  return (process.env.ENABLE_ALPHA_LIMITS || "false").toLowerCase() === "true";
}
