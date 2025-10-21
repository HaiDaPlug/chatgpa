import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { runtime: 'nodejs' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || '';

  if (!process.env.ADMIN_BYPASS_KEY) {
    return res.status(500).json({ error: 'ADMIN_BYPASS_KEY missing' });
  }
  if (token !== process.env.ADMIN_BYPASS_KEY) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // 24h bypass cookie
  const cookie = [
    `bp=1`,
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Max-Age=86400`
  ].join('; ');

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
}
