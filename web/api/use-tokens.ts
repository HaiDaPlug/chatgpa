import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
export const config = { runtime: 'nodejs' };

const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { userId, tokens } = (req.body ?? {}) as { userId?: string; tokens?: number };
    if (!userId || !tokens || tokens <= 0) {
      return res.status(400).json({ error: "Invalid userId or tokens" });
    }

    // spend_tokens returns { ok: boolean, remaining?: number, personal?: number, reserve?: number, community_bonus?: number }
    const { data, error } = await supa.rpc("spend_tokens", {
      p_user_id: userId,
      p_amount: tokens,
    });

    if (error) return res.status(400).json({ error: error.message });
    if (!data?.ok) return res.status(402).json({ error: "out_of_tokens", remaining: data?.remaining ?? 0 });

    return res.status(200).json(data);
  } catch (e: any) {
    console.error("use-tokens error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
