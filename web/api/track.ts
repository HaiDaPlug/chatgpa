// Purpose: Lightweight server-side telemetry collector (Alpha-safe).
// POST /api/track  { event: string, data?: object }
// Returns: 204 on success; { code, message } on error.
//
// Behavior:
// - Validates shape with Zod
// - Optional user binding via Supabase Bearer (RLS-friendly if you later add a table)
// - Soft-inserts into Supabase table if configured; otherwise just console.logs
// - In-memory rate-limit per (userId|ip)+event (to avoid spam during Alpha)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

// ---- Config knobs
const TABLE = process.env.NEXT_PUBLIC_TELEMETRY_TABLE || "telemetry_events";
const ENABLE_DB = (process.env.ENABLE_SERVER_TELEMETRY || "false").toLowerCase() === "true";

// ---- Simple in-memory limiter (serverless-coldstart tolerant enough for Alpha)
type RL = { ts: number };
const rl: Record<string, RL[]> = {};
const WINDOW_MS = 10_000; // 10s window
const MAX_EVENTS = 15;    // 15 events / 10s per key

const Body = z.object({
  event: z.string().min(3).max(64),
  data: z.record(z.any()).optional(),
});

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ code, message }, { status });
}

function keyOf(userId: string | null, ip: string | null, ev: string) {
  return `${userId ?? "anon"}:${ip ?? "ip"}:${ev}`;
}

function rateLimit(k: string) {
  const now = Date.now();
  rl[k] = (rl[k] || []).filter((e) => now - e.ts <= WINDOW_MS);
  if (rl[k].length >= MAX_EVENTS) return false;
  rl[k].push({ ts: now });
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // 1) Parse + validate
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return err("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid payload");
    }
    const { event, data } = parsed.data;

    // 2) Caller identity (optional)
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    // Validate required environment variables (log warning but continue)
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[TRACK_API] Missing Supabase environment variables - user attribution disabled');
    }

    let user_id: string | null = null;
    if (token && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: u } = await supabase.auth.getUser();
      user_id = u?.user?.id ?? null;
    }

    // 3) Rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const key = keyOf(user_id, ip, event);
    if (!rateLimit(key)) {
      return err("RATE_LIMITED", "Too many telemetry events", 429);
    }

    // 4) Console log (always)
    // eslint-disable-next-line no-console
    console.log("[telemetry]", {
      event,
      user_id,
      ip,
      data: data ?? {},
      ts: new Date().toISOString(),
    });

    // 5) Optional DB persist (no-throw)
    if (ENABLE_DB && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      });
      // Expected table schema (later migration):
      // telemetry_events: id uuid pk, user_id uuid, event text, data jsonb, ip text, created_at timestamptz default now()
      await supabase.from(TABLE).insert([{ user_id, event, data: data ?? {}, ip }]);
      // ignore errors on purpose; telemetry must not break flow
    }

    return new NextResponse(null, { status: 204 });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("TRACK_API_ERROR", e);
    return err("INTERNAL_ERROR", "Could not record telemetry", 500);
  }
}
