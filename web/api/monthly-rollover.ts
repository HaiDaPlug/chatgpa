import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
export const config = { runtime: 'nodejs' };

const supa = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { error } = await supa.rpc("monthly_rollover");
    if (error) {
      console.error("monthly_rollover failed:", error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("monthly-rollover error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
