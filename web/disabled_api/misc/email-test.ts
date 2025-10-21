import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { confirmationEmail } from '../lib/confirmationEmail'; // or inline your own

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { to } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    if (!to) return res.status(400).json({ error: 'Missing "to"' });

    const key = process.env.RESEND_API_KEY;
    const from = process.env.FROM_EMAIL || 'Carpool AI <contact@khyteteam.com>';
    const base = process.env.PUBLIC_BASE_URL || 'https://carpoolai.app';
    if (!key) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

    const resend = new Resend(key);
    const { subject, text, html } = confirmationEmail(base);

    const resp = await resend.emails.send({
      from,
      to: [to],
      subject,
      text,
      html,
      headers: { 'List-Unsubscribe': '<mailto:contact@khyteteam.com>' }
    });

    // @ts-ignore – SDK types vary
    return res.status(200).json({ ok: true, id: resp?.data?.id ?? null });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Resend error' });
  }
}
