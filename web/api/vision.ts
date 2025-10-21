// POST /api/vision
// body: { prompt: string, imageUrl?: string, imageBase64?: string, user_id?: string }
import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { runtime: "nodejs" };

type Body = { prompt: string; imageUrl?: string; imageBase64?: string; user_id?: string };

const MODE = process.env.APP_MODE === "live" ? "LIVE" : "TEST";
const MISTRAL_API_KEY = process.env[`MISTRAL_API_KEY_${MODE}`]!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MODEL = process.env.MISTRAL_VISION_MODEL || "pixtral-12b-2409";
const MAX_TOKENS_PER_CALL = Number(process.env.MAX_TOKENS_PER_CALL || "120000");

function bad(res: VercelResponse, status: number, code: string, detail?: string) {
  return res.status(status).json({ error: code, detail });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return bad(res, 405, "method_not_allowed");
  if (!MISTRAL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return bad(res, 500, "server_config_missing");
  }

  const b = (req.body || {}) as Body;
  if (!b.prompt || (!b.imageUrl && !b.imageBase64)) {
    return bad(res, 400, "invalid_body", "need prompt + imageUrl|imageBase64");
  }

  // Build Mistral content
  const content: any[] = [{ type: "text", text: b.prompt }];
  if (b.imageUrl) content.push({ type: "image_url", image_url: b.imageUrl });
  if (b.imageBase64) content.push({ type: "image", image: b.imageBase64 });

  // Call Mistral vision
  let answer = ""; let usageIn = 0; let usageOut = 0;
  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${MISTRAL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content }], temperature: 0.2 }),
    });
    if (!r.ok) return bad(res, 502, "mistral_request_failed", (await r.text()).slice(0, 500));
    const j = await r.json();
    answer = j?.choices?.[0]?.message?.content ?? "";
    usageIn = j?.usage?.prompt_tokens ?? 0;
    usageOut = j?.usage?.completion_tokens ?? 0;
    if (!answer) return bad(res, 502, "mistral_empty_reply");
  } catch (e: any) {
    return bad(res, 502, "mistral_call_error", String(e?.message || e));
  }

  // Token accounting
  const estimated = Math.ceil((b.prompt.length + answer.length) / 4);
  const totalRaw = (usageIn + usageOut) || estimated;
  const total = Math.min(Math.max(1, totalRaw), MAX_TOKENS_PER_CALL);
  const userId = b.user_id || "00000000-0000-0000-0000-000000000000";

  // Non-blocking ledger ops
  const rpc = fetch(`${SUPABASE_URL}/rest/v1/rpc/spend_tokens`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: userId, tokens: total, source: "vision", model: MODEL,
      meta: { provider: "mistral", usageIn, usageOut, ts: new Date().toISOString() },
    }),
  });

  const log = fetch(`${SUPABASE_URL}/rest/v1/mvp_usage_logs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify([{
      user_id: userId, event: "image_analyze", model: MODEL,
      tokens_spent: total,
      meta: { provider: "mistral", usageIn, usageOut },
      created_at: new Date().toISOString(),
    }]),
  });

  await Promise.allSettled([rpc, log]);

  return res.status(200).json({
    ok: true,
    provider: "mistral",
    model: MODEL,
    answer,
    usage: { prompt_tokens: usageIn, completion_tokens: usageOut, total_tokens: total },
  });
}
