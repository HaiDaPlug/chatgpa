// src/lib/rateLimit.ts
import { supabaseAdmin } from "./supabaseAdmin";

interface RateLimitConfig {
  ip: string;
  bucket: string;
  limit: number;
  windowSec: number;
}

/**
 * Simple per-IP rate limiter using Supabase security_events table
 * @returns true if request is allowed, false if rate limit exceeded
 */
export async function allowRequest({
  ip,
  bucket,
  limit,
  windowSec,
}: RateLimitConfig): Promise<boolean> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();

  // Count recent events for this IP+bucket
  const { count, error: countError } = await supabaseAdmin
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since)
    .eq("ip", ip)
    .eq("bucket", bucket);

  if (countError) {
    console.error("Rate limit count error:", countError);
    return true; // Fail open (allow request) if DB error
  }

  if ((count ?? 0) >= limit) {
    return false; // Rate limit exceeded
  }

  // Record this request
  const { error: insertError } = await supabaseAdmin
    .from("security_events")
    .insert({ ip, bucket });

  if (insertError) {
    console.error("Rate limit insert error:", insertError);
  }

  return true;
}

/**
 * Extract IP from request headers (works with Vercel/Cloudflare proxies)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Fallback to other headers
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  // Last resort
  return "0.0.0.0";
}

/**
 * Verify Cloudflare Turnstile CAPTCHA token
 */
export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY || import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not configured");
    return true; // Fail open during transition
  }
  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await resp.json();
    return !!data.success;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}
