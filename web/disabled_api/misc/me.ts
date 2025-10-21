import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cookies = req.headers.cookie || '';
  const hasBypass = cookies.split(';').some(c => c.trim().startsWith('bp=1'));
  const waitlist = process.env.WAITLIST_MODE === 'true';
  return res.status(200).json({ bypass: hasBypass, waitlist });
}
