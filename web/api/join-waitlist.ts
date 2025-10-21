// web/api/join-waitlist.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const config = { runtime: 'nodejs' };

/* ------------ Local email template (inlined to avoid import path issues) ------------ */
function confirmationEmail(siteUrl: string) {
  const subject = "You’re on the Carpool AI waitlist 🚗⛽";

  const text = `You’re in! Thanks for joining the Carpool AI waitlist.
You’ll be among the first to try Carpool AI and receive your founding-rider bonus fuel.

Visit: ${siteUrl}

— Carpool AI
contact@khyteteam.com`;

  const html = `<!DOCTYPE html>
<html>
  <body style="background-color:#1c1917; color:#f5f5f4; font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; padding:40px 16px; margin:0;">
    <table width="100%" style="max-width:600px; margin:0 auto;">
      <tr>
        <td style="text-align:center; padding-bottom:32px;">
          <img src="${siteUrl}/favicon.svg" alt="Carpool AI" style="width:48px; height:48px; margin-bottom:12px;" />
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

/* ------------ Config / Utils ------------ */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function setCors(res: VercelResponse, origin?: string) {
  const allowed = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  let allow = '';
  if (origin) {
    const o = origin.toLowerCase();
    if (allowed.includes(o)) allow = origin;            // exact allowlist
    else if (o.endsWith('.vercel.app')) allow = origin; // preview domains
  }

  if (allow) res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function safeJsonParse<T = any>(val: unknown): T | null {
  if (val == null) return null;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return null;
}

function json(res: VercelResponse, code: number, payload: any) {
  try { return res.status(code).json(payload); }
  catch { return res.status(code).send(typeof payload === 'string' ? payload : ''); }
}

/* ------------ Handler ------------ */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req.headers.origin as string | undefined);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  // Env guards
  const url = process.env.SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE;
  if (!url) return json(res, 500, { error: 'Missing SUPABASE_URL in Vercel env' });
  if (!service) return json(res, 500, { error: 'Missing SUPABASE_SERVICE_ROLE in Vercel env' });

  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = safeJsonParse<{ email?: string; source?: string; trap?: string }>(req.body) ?? {};
    const { email, source, trap } = body;

    // Honeypot (silently accept bots)
    if (trap && String(trap).trim() !== '') {
      return json(res, 200, { ok: true });
    }

    // Validate email
    if (!email || !EMAIL_REGEX.test(String(email))) {
      return json(res, 400, { error: 'Invalid email' });
    }

    const normalized = String(email).trim().toLowerCase();

    // Insert
    const { error } = await supabase
      .from('waitlist_emails')
      .insert({
        email: normalized,
        source: (source ?? '').slice(0, 64),
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? null,
        ua: req.headers['user-agent'] ?? null,
      });

    if (error) {
      const msg = String((error as any)?.message || error);
      if (!msg.toLowerCase().includes('duplicate')) {
        console.error('Supabase insert error:', error);
        return json(res, 500, { error: `Supabase error: ${msg}` });
      }
    }

    // ---- Confirmation email (non-blocking) ----
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
      } else {
        console.warn('RESEND_API_KEY not set; skipping confirmation email');
      }
    } catch (mailErr: any) {
      console.error('Email send failed (non-blocking):', mailErr?.message || mailErr);
    }

    return json(res, 201, { ok: true });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error('Server error:', msg, e?.stack || '');
    return json(res, 500, { error: msg });
  }
}
