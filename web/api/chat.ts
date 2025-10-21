// web/api/chat.ts — V15 stable+ (types, request_id, stricter validation, better logs)
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

/* ---------------- Types ---------------- */
type Role = "user" | "assistant" | "system";
type Msg = { role: Role; content: string };

type ChatBody = {
  messages: Msg[];
  model?: string;
  user_id?: string; // server-derived in prod; accepted temporarily
  userId?: string;  // client may send camelCase
};

type OpenAIChatChoice = {
  index: number;
  message: { role: Role; content: string };
  finish_reason: string | null;
};

type OpenAIChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenAIChatResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage?: OpenAIChatUsage;
};

/* ---------------- Config ---------------- */
// Select TEST or LIVE mode
const mode = process.env.APP_MODE === "live" ? "LIVE" : "TEST";

// Mode-aware OpenAI configuration
const OPENAI_API_KEY = process.env[`OPENAI_API_KEY_${mode}`];
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";
/** Keep V15 default = GPT-5. Do NOT downgrade model here. */
const ALLOWED_MODELS = (process.env.ALLOWED_MODELS ??
  "gpt-5,gpt-4o,gpt-4-turbo").split(",");

const SYSTEM_PROMPT =
  process.env.CARPOOL_CHAT_SYSTEM || "You are a helpful assistant.";
const MAX_TOKENS_PER_CALL = Number(process.env.MAX_TOKENS_PER_CALL || "120000");

/** Input size guards (abuse control without breaking UX) */
const MAX_MESSAGES = 32;
const MAX_TOTAL_CHARS = 10000; // ~2.5k tokens rough cap for V15

/* ---------------- Helpers ---------------- */
function sendJSON(res: VercelResponse, status: number, data: unknown) {
  res.status(status).setHeader("Content-Type", "application/json").send(data);
}
function sendError(
  res: VercelResponse,
  status: number,
  code:
    | "method_not_allowed"
    | "invalid_body"
    | "server_config_missing"
    | "openai_request_failed"
    | "openai_empty_reply"
    | "openai_call_error"
    | "openai_timeout"
    | "invalid_model",
  detail?: string,
  request_id?: string
) {
  const payload: any = { error: code };
  if (detail) payload.detail = detail;
  if (request_id) payload.request_id = request_id;
  return sendJSON(res, status, payload);
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function uuidv4() {
  // RFC4122-ish; fine for request correlation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ---------------- Handler ---------------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const request_id = uuidv4();
  const ts = new Date().toISOString();

  // 0) Method check
  if (req.method !== "POST") {
    return sendError(res, 405, "method_not_allowed", undefined, request_id);
  }

  // 1) Env check
  const missing: string[] = [];
  if (!OPENAI_API_KEY) missing.push(`OPENAI_API_KEY_${mode}`);
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    return sendError(
      res,
      500,
      "server_config_missing",
      `${mode} mode - missing: ${missing.join(", ")}`,
      request_id
    );
  }

  // 2) Parse & validate body
  let body: ChatBody | null = null;
  try {
    body = (req.body ?? {}) as ChatBody;
  } catch {
    return sendError(res, 400, "invalid_body", "JSON parse failed", request_id);
  }
  if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return sendError(res, 400, "invalid_body", "messages array required", request_id);
  }
  if (body.messages.length > MAX_MESSAGES) {
    return sendError(
      res,
      400,
      "invalid_body",
      `too many messages (max ${MAX_MESSAGES})`,
      request_id
    );
  }
  let totalChars = 0;
  for (const m of body.messages) {
    if (!m || typeof m.content !== "string" || !m.role) {
      return sendError(res, 400, "invalid_body", "invalid message item", request_id);
    }
    if (!["user", "assistant", "system"].includes(m.role)) {
      return sendError(res, 400, "invalid_body", "invalid role", request_id);
    }
    totalChars += m.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return sendError(
      res,
      400,
      "invalid_body",
      `messages too large (max ${MAX_TOTAL_CHARS} chars)`,
      request_id
    );
  }

  const model = body.model || OPENAI_MODEL;
  if (!ALLOWED_MODELS.includes(model)) {
    // Keep strict but informative; don’t auto-downgrade.
    return sendError(
      res,
      400,
      "invalid_model",
      `model "${model}" is not in ALLOWED_MODELS`,
      request_id
    );
  }
  const userId =
    body.user_id || body.userId || "00000000-0000-0000-0000-000000000000"; // TODO: replace with auth-derived user

  // 3) Build OpenAI payload (non-streaming)
  const openaiPayload = {
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT } as Msg, ...body.messages],
    temperature: 0.7,
  };

  // 4) OpenAI call with 30s timeout
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 30_000);
  let replyText = "";
  let usage: OpenAIChatUsage = {};
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiPayload),
    });
    clearTimeout(t);

    if (!r.ok) {
      const detail = (await r.text().catch(() => "")).slice(0, 500);
      return sendError(res, 502, "openai_request_failed", detail, request_id);
    }

    const data = (await r.json()) as OpenAIChatResponse;
    replyText = data?.choices?.[0]?.message?.content ?? "";
    usage = data?.usage || {};
    if (!replyText) {
      return sendError(res, 502, "openai_empty_reply", undefined, request_id);
    }
  } catch (e: any) {
    clearTimeout(t);
    if (e?.name === "AbortError") {
      return sendError(res, 504, "openai_timeout", undefined, request_id);
    }
    return sendError(res, 502, "openai_call_error", String(e?.message || e), request_id);
  }

  // 5) Token accounting (fallback + cap)
  const usedFallback = !usage?.total_tokens;
  let totalTokens =
    usage?.total_tokens ??
    Math.max(1, Math.ceil(replyText.length / 4)); // fast & light estimator for V15
  totalTokens = clamp(totalTokens, 1, MAX_TOKENS_PER_CALL);

  // 6) Spend tokens + log usage (run in parallel safely)
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/spend_tokens`;
  const logsUrl = `${SUPABASE_URL}/rest/v1/mvp_usage_logs`;

  const rpcBody = {
    user_id: userId,            // uuid
    tokens: totalTokens,        // bigint
    source: "chat",             // text
    model,                      // text
    meta: { reason: "chat_message", ts, request_id }, // jsonb
  };

  const inputChars = body.messages.map((m) => m.content).join(" ").length;
  const logRow = [
    {
      user_id: userId,
      event: "chat_message",
      model,
      tokens_spent: totalTokens || null,
      meta: {
        input_chars: inputChars,
        output_chars: replyText.length,
        used_fallback_estimate: usedFallback,
        request_id,
      },
      created_at: ts,
    },
  ];

  const [spendP, logP] = [
    fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(rpcBody),
    }),
    fetch(logsUrl, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(logRow),
    }),
  ];

  const [spendRes, logRes] = await Promise.allSettled([spendP, logP]);

  const spend =
    spendRes.status === "fulfilled"
      ? {
          ok: spendRes.value.ok,
          status: spendRes.value.status,
          text: await spendRes.value.text().catch(() => ""),
        }
      : { ok: false, status: 500, text: String(spendRes.reason || "") };

  const usage_log =
    logRes.status === "fulfilled"
      ? {
          ok: logRes.value.ok,
          status: logRes.value.status,
          text: await logRes.value.text().catch(() => ""),
        }
      : { ok: false, status: 500, text: String(logRes.reason || "") };

  // minimal server log for observability (no secrets/content)
  if (!spend.ok) console.warn({ code: "spend_failed", status: spend.status, request_id });
  if (!usage_log.ok) console.warn({ code: "usage_log_failed", status: usage_log.status, request_id });

  // 7) Success response (with metadata)
  return sendJSON(res, 200, {
    ok: true,
    mode: process.env.APP_MODE || "test",
    model,
    reply: replyText,
    usage: {
      total_tokens: totalTokens,
      prompt_tokens: usage.prompt_tokens || undefined,
      completion_tokens: usage.completion_tokens || undefined,
      used_fallback_estimate: usedFallback || undefined,
    },
    timestamp: ts,
    request_id,
    warnings: [
      ...(!spend.ok ? ["spend_tokens_failed"] : []),
      ...(!usage_log.ok ? ["usage_log_failed"] : []),
    ],
    spend,
    usage_log,
  });
}
