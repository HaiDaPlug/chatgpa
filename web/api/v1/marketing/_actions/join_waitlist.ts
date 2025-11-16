// Purpose: Join waitlist with email + optional name
// Migrated from: /api/router?action=join-waitlist (and /api/join-waitlist)
// Features: Turnstile verification, rate limiting, honeypot, Resend email

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { JoinWaitlistInput } from '../_schemas';

/**
 * Confirmation email template
 */
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

/**
 * Verify Cloudflare Turnstile CAPTCHA
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

/**
 * Rate limiting via security_events table
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

export async function join_waitlist(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, ip } = context;

  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw {
      code: 'SERVER_CONFIG_MISSING',
      message: 'Missing SUPABASE_URL',
      status: 500
    };
  }
  if (!service) {
    throw {
      code: 'SERVER_CONFIG_MISSING',
      message: 'Missing SUPABASE_SERVICE_ROLE_KEY',
      status: 500
    };
  }

  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate input with Zod
  const parseResult = JoinWaitlistInput.safeParse(data);
  if (!parseResult.success) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'join_waitlist',
        error: 'validation_error',
        details: parseResult.error.issues,
        message: 'Invalid waitlist signup input'
      })
    );
    throw {
      code: 'INVALID_INPUT',
      message: 'Invalid input',
      status: 400
    };
  }

  const { email, name, source, trap, turnstileToken } = parseResult.data;

  // Honeypot check
  if (trap && String(trap).trim() !== '') {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        request_id,
        action: 'join_waitlist',
        ip,
        message: '🍯 Honeypot triggered'
      })
    );
    return { ok: true }; // Silently accept
  }

  // Rate limit: 5 requests per 60 seconds per IP
  const allowed = await allowRequest(ip || 'unknown', `waitlist:${ip}`, 5, 60, supabase);
  if (!allowed) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        request_id,
        action: 'join_waitlist',
        ip,
        message: '⚠️ Rate limit exceeded'
      })
    );
    throw {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      status: 429
    };
  }

  // Turnstile verification (respects TURNSTILE_ENFORCE)
  const enforce = process.env.TURNSTILE_ENFORCE === '1';
  if (enforce) {
    if (!turnstileToken) {
      throw {
        code: 'CAPTCHA_REQUIRED',
        message: 'CAPTCHA verification required',
        status: 400
      };
    }
    const human = await verifyTurnstile(turnstileToken, ip || 'unknown');
    if (!human) {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          request_id,
          action: 'join_waitlist',
          ip,
          message: '🤖 Turnstile failed'
        })
      );
      throw {
        code: 'CAPTCHA_FAILED',
        message: 'CAPTCHA verification failed',
        status: 400
      };
    }
  } else if (turnstileToken) {
    // Optional verification during transition
    const human = await verifyTurnstile(turnstileToken, ip || 'unknown');
    if (!human) {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          request_id,
          action: 'join_waitlist',
          ip,
          message: '🤖 Turnstile failed (optional)'
        })
      );
    }
  }

  const normalized = String(email).trim().toLowerCase();

  // Insert into waitlist_emails
  const { error } = await supabase.from('waitlist_emails').insert({
    email: normalized,
    name: name || null,
    source: source ? source.slice(0, 64) : 'landing',
    ip: ip || null,
    ua: context.req.headers['user-agent'] || null,
  });

  if (error) {
    const msg = String((error as any)?.message || error);
    const code = (error as any)?.code;

    // Check for duplicate email (unique violation)
    if (code === '23505' || msg.toLowerCase().includes('duplicate')) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          request_id,
          action: 'join_waitlist',
          email: normalized,
          message: 'ℹ️ Duplicate signup attempt'
        })
      );
      return { ok: true, duplicate: true };
    }

    // Other database errors
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'join_waitlist',
        error: 'database_error',
        message: 'Supabase insert error'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Could not save signup',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'join_waitlist',
      email: normalized,
      name: name || 'no name',
      message: '✅ Waitlist signup'
    })
  );

  // Send confirmation email (non-blocking)
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
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          request_id,
          action: 'join_waitlist',
          email: normalized,
          message: '📧 Confirmation email sent'
        })
      );
    } else {
      console.warn(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'warn',
          request_id,
          action: 'join_waitlist',
          message: '⚠️ RESEND_API_KEY not set; skipping confirmation email'
        })
      );
    }
  } catch (mailErr: any) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'join_waitlist',
        error: 'email_send_failed',
        message: mailErr?.message || 'Unknown email error'
      })
    );
  }

  return { ok: true };
}
