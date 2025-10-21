// web/api/router.ts - Consolidated router for multiple endpoints
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { z } from 'zod';
import Stripe from 'stripe';

export const config = { runtime: 'nodejs' };

/* ------------ Validation Schemas ------------ */
const waitlistSchema = z.object({
  email: z.string().email().max(120),
  name: z.string().max(80).optional(),
  source: z.string().max(64).optional(),
  trap: z.string().optional(), // Honeypot
  turnstileToken: z.string().min(10).max(10_000).optional(),
});

const stripeCheckoutSchema = z.object({
  tier: z.enum(['Cruiser', 'Power', 'Pro']),
  userId: z.string().uuid(),
  email: z.string().email(),
});

const stripePortalSchema = z.object({
  userId: z.string().uuid(),
});

/* ------------ Shared Utils ------------ */

/**
 * safeCall: Global error handler wrapper
 * Catches any unhandled exception and returns JSON 500
 */
function safeCall(
  fn: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Ensure Content-Type is always JSON
      res.setHeader('Content-Type', 'application/json');
      return await fn(req, res);
    } catch (err: any) {
      console.error('❌ Unhandled error in safeCall:', err?.stack || err);
      // If response already sent, don't try to send again
      if (res.headersSent) return;
      return res.status(500).json({ error: 'Server error' });
    }
  };
}

/**
 * setCors: Set CORS headers for all responses
 */
function setCors(res: VercelResponse, origin?: string) {
  const allowed = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let allow = '';
  if (origin) {
    const o = origin.toLowerCase();
    if (allowed.includes(o)) allow = origin;
    else if (o.endsWith('.vercel.app')) allow = origin;
  }

  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * safeJsonParse: Defensively parse JSON from request body
 */
function safeJsonParse<T = any>(val: unknown): T | null {
  if (val == null) return null;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch (err) {
      console.error('JSON parse error:', err);
      return null;
    }
  }
  return null;
}

/**
 * json: Always return JSON response
 */
function json(res: VercelResponse, code: number, payload: any) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(code).json(payload);
}

/**
 * getClientIp: Extract client IP from Vercel headers
 */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return (req.headers['x-real-ip'] as string) || '0.0.0.0';
}

/**
 * allowRequest: Rate limiting via security_events table
 */
async function allowRequest(
  ip: string,
  bucket: string,
  limit: number,
  windowSec: number,
  supabase: any
): Promise<boolean> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();

  const { count, error } = await supabase
    .from('security_events')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
    .eq('ip', ip)
    .eq('bucket', bucket);

  if (error) {
    console.error('Rate limit check error:', error);
    return true; // Fail open on DB error
  }

  if ((count ?? 0) >= limit) {
    return false;
  }

  // Record this request
  await supabase.from('security_events').insert({ ip, bucket });
  return true;
}

/**
 * verifyTurnstile: Verify Cloudflare Turnstile CAPTCHA
 */
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('TURNSTILE_SECRET_KEY not configured');
    return true; // Fail open if not configured
  }

  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await resp.json();
    return !!data.success;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

/* ------------ Email Template ------------ */
function confirmationEmail(siteUrl: string) {
  const subject = "You're on the Carpool AI waitlist 🚗⛽";

  const text = `You're in! Thanks for joining the Carpool AI waitlist.
You'll be among the first to try Carpool AI and receive your founding-rider bonus fuel.

Visit: ${siteUrl}

— Carpool AI
contact@khyteteam.com`;

  const html = `<!DOCTYPE html>
<html>
  <body style="background-color:#1c1917; color:#f5f5f4; font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; padding:40px 16px; margin:0;">
    <table width="100%" style="max-width:600px; margin:0 auto;">
      <tr>
        <td style="text-align:center; padding-bottom:32px;">
          <img src="${siteUrl}/favicon.png" alt="Carpool AI" style="width:48px; height:48px; margin-bottom:12px;" />
          <h1 style="font-size:28px; margin:0; color:#f5f5f4; font-weight:600; letter-spacing:-0.025em;">Carpool AI</h1>
        </td>
      </tr>
      <tr>
        <td style="background:#292524; border:1px solid #44403c; border-radius:16px; padding:32px; text-align:center;">
          <h2 style="margin:0 0 16px 0; font-size:24px; color:#f5f5f4; font-weight:600;">You're in! 🎉</h2>
          <p style="margin:0 0 8px 0; font-size:16px; line-height:1.6; color:#d6d3d1;">
            Thanks for joining the waitlist. You'll be among the first to try Carpool AI and receive your <strong style="color:#f5f5f4;">Early Rider bonus fuel</strong>.
          </p>
          <p style="margin:16px 0 24px 0; font-size:16px; line-height:1.6; color:#d6d3d1;">
            We'll email you before doors open.
          </p>
          <a href="${siteUrl}"
             style="display:inline-block; background:#f5f5f4; color:#1c1917; text-decoration:none;
                    padding:12px 24px; border-radius:12px; font-weight:600; font-size:15px;">
            Visit Carpool AI
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding-top:32px; text-align:center; font-size:13px; color:#78716c; line-height:1.6;">
          © ${new Date().getFullYear()} Carpool AI<br/>
          <a href="mailto:contact@khyteteam.com" style="color:#a8a29e; text-decoration:none;">contact@khyteteam.com</a><br/>
          <span style="color:#57534e; font-size:12px;">If this isn't for you, you can safely ignore this email.</span>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

/* ------------ Action Handlers ------------ */

/**
 * handleJoinWaitlist: Join the waitlist with email + optional name
 */
async function handleJoinWaitlist(req: VercelRequest, res: VercelResponse) {
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) return json(res, 500, { error: 'Missing SUPABASE_URL' });
  if (!service) return json(res, 500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = getClientIp(req);

  // Parse body defensively
  const body = safeJsonParse<{
    email?: string;
    name?: string;
    source?: string;
    trap?: string;
    turnstileToken?: string;
  }>(req.body) ?? {};

  // 1) Validate input with Zod
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    console.error('Validation error:', parsed.error.issues);
    return json(res, 400, { error: 'Invalid input' });
  }

  const { email, name, source, trap, turnstileToken } = parsed.data;

  // 2) Honeypot check
  if (trap && String(trap).trim() !== '') {
    console.log(`🍯 Honeypot triggered for IP ${ip}`);
    return json(res, 200, { ok: true }); // Silently accept
  }

  // 3) Rate limit: 5 requests per 60 seconds per IP
  const allowed = await allowRequest(ip, `waitlist:${ip}`, 5, 60, supabase);
  if (!allowed) {
    console.warn(`⚠️ Rate limit exceeded for IP ${ip}`);
    return json(res, 429, { error: 'Too many requests. Please try again later.' });
  }

  // 4) Turnstile verification (respects TURNSTILE_ENFORCE)
  const enforce = process.env.TURNSTILE_ENFORCE === '1';
  if (enforce) {
    if (!turnstileToken) {
      return json(res, 400, { error: 'CAPTCHA verification required' });
    }
    const human = await verifyTurnstile(turnstileToken, ip);
    if (!human) {
      console.warn(`🤖 Turnstile failed for IP ${ip}`);
      return json(res, 400, { error: 'CAPTCHA verification failed' });
    }
  } else if (turnstileToken) {
    // Optional verification during transition
    const human = await verifyTurnstile(turnstileToken, ip);
    if (!human) {
      console.warn(`🤖 Turnstile failed (optional) for IP ${ip}`);
    }
  }

  const normalized = String(email).trim().toLowerCase();

  // 5) Insert into waitlist_emails
  const { error } = await supabase.from('waitlist_emails').insert({
    email: normalized,
    name: name || null,
    source: source ? source.slice(0, 64) : 'landing',
    ip,
    ua: req.headers['user-agent'] || null,
  });

  if (error) {
    const msg = String((error as any)?.message || error);
    const code = (error as any)?.code;

    // Check for duplicate email (unique violation)
    if (code === '23505' || msg.toLowerCase().includes('duplicate')) {
      console.log(`ℹ️ Duplicate signup attempt: ${normalized}`);
      return json(res, 200, { ok: true, duplicate: true });
    }

    // Other database errors
    console.error('❌ Supabase insert error:', error);
    return json(res, 500, { error: 'Could not save signup' });
  }

  console.log(`✅ Waitlist signup: ${normalized} (${name || 'no name'})`);

  // 6) Send confirmation email (non-blocking)
  try {
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || 'Carpool AI <contact@khyteteam.com>';
    const publicBase = process.env.PUBLIC_BASE_URL || 'https://carpoolai.app';

    if (resendKey) {
      const resend = new Resend(resendKey);
      const { subject, text, html } = confirmationEmail(publicBase);

      await resend.emails.send({
        from: fromEmail,
        to: [normalized],
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': '<mailto:contact@khyteteam.com>',
        },
      });
      console.log(`📧 Confirmation email sent to ${normalized}`);
    } else {
      console.warn('⚠️ RESEND_API_KEY not set; skipping confirmation email');
    }
  } catch (mailErr: any) {
    console.error('📧 Email send failed (non-blocking):', mailErr?.message || mailErr);
  }

  return json(res, 200, { ok: true });
}

/**
 * handleStripeCheckout: Create Stripe checkout session (MODE-AWARE)
 */
async function handleStripeCheckout(req: VercelRequest, res: VercelResponse) {
  // Select TEST or LIVE mode
  const mode = process.env.APP_MODE === "live" ? "LIVE" : "TEST";

  const STRIPE_SECRET = process.env[`STRIPE_SECRET_KEY_${mode}`];
  if (!STRIPE_SECRET) {
    console.error(JSON.stringify({ scope: 'stripe-checkout', error: 'missing_stripe_key', mode }));
    return json(res, 500, { error: 'server_config_missing', missing: [`STRIPE_SECRET_KEY_${mode}`] });
  }

  // Validate input
  const parsed = stripeCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error(JSON.stringify({ scope: 'stripe-checkout', error: 'invalid_body', details: parsed.error.issues }));
    return json(res, 400, { error: 'invalid_body' });
  }

  const { tier, userId, email } = parsed.data;

  // Normalize tier to lowercase for env lookup (mode-aware)
  const tierLower = tier.toLowerCase();
  const PRICE_ID = tierLower === 'cruiser'
    ? process.env[`STRIPE_PRICE_CRUISER_${mode}`]
    : tierLower === 'power'
    ? process.env[`STRIPE_PRICE_POWER_${mode}`]
    : tierLower === 'pro'
    ? process.env[`STRIPE_PRICE_PRO_${mode}`]
    : null;

  if (!PRICE_ID) {
    console.error(JSON.stringify({ scope: 'stripe-checkout', error: 'price_not_configured', tier }));
    return json(res, 400, { error: 'price_not_configured', tier });
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: email,
      metadata: { userId, tier },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.carpoolai.app'}/chat?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.carpoolai.app'}/#pricing`,
    });

    console.log(JSON.stringify({
      scope: 'stripe-checkout',
      tier,
      priceId: PRICE_ID.substring(0, 15) + '...',
      sessionId: session.id
    }));

    return json(res, 200, { url: session.url });
  } catch (err: any) {
    console.error(JSON.stringify({
      scope: 'stripe-checkout',
      error: 'stripe_api_error',
      message: err?.message,
      tier
    }));
    return json(res, 500, { error: 'unhandled', message: err?.message });
  }
}

/**
 * handleStripePortal: Create Stripe billing portal session (MODE-AWARE)
 */
async function handleStripePortal(req: VercelRequest, res: VercelResponse) {
  // Select TEST or LIVE mode
  const mode = process.env.APP_MODE === "live" ? "LIVE" : "TEST";

  const STRIPE_SECRET = process.env[`STRIPE_SECRET_KEY_${mode}`];
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!STRIPE_SECRET) {
    console.error(JSON.stringify({ scope: 'stripe-portal', error: 'missing_stripe_key', mode }));
    return json(res, 500, { error: 'server_config_missing', missing: [`STRIPE_SECRET_KEY_${mode}`] });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(JSON.stringify({ scope: 'stripe-portal', error: 'missing_supabase_config' }));
    return json(res, 500, { error: 'server_config_missing', missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] });
  }

  const parsed = stripePortalSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error(JSON.stringify({ scope: 'stripe-portal', error: 'invalid_body' }));
    return json(res, 400, { error: 'invalid_body' });
  }

  const { userId } = parsed.data;

  try {
    // Fetch customer_id from mvp_billing
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: billing, error: billingError } = await supabase
      .from('mvp_billing')
      .select('customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (billingError || !billing?.customer_id) {
      console.log(JSON.stringify({ scope: 'stripe-portal', error: 'no_customer', userId: userId.substring(0, 8) + '...' }));
      return json(res, 404, { error: 'no_customer_for_user' });
    }

    const stripe = new Stripe(STRIPE_SECRET, { apiVersion: '2025-08-27.basil' });

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.carpoolai.app'}/account`,
    });

    console.log(JSON.stringify({
      scope: 'stripe-portal',
      customerId: billing.customer_id.substring(0, 12) + '...',
      sessionId: session.id
    }));

    return json(res, 200, { url: session.url });
  } catch (err: any) {
    console.error(JSON.stringify({
      scope: 'stripe-portal',
      error: 'unhandled',
      message: err?.message
    }));
    return json(res, 500, { error: 'unhandled', message: err?.message });
  }
}

/* ------------ Main Router ------------ */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always set CORS headers
  setCors(res, req.headers.origin as string | undefined);

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const action = req.query.action as string;

  // Route to action handlers with safeCall wrapper
  switch (action) {
    case 'join-waitlist':
      return safeCall(handleJoinWaitlist)(req, res);
    case 'stripe-checkout':
      return safeCall(handleStripeCheckout)(req, res);
    case 'stripe-portal':
      return safeCall(handleStripePortal)(req, res);
    default:
      return json(res, 400, { error: 'Invalid action' });
  }
}
