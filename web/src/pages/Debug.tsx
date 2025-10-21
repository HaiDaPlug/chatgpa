import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { IS_TEST } from "@/config/appMode";

type SessionSnapshot = {
  userId: string | null;
  email: string | null;
  authenticated: boolean;
};

function Row({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-2">
      <div className="text-stone-400 text-sm">{label}</div>
      <div className="text-stone-100 text-sm font-mono">{String(value)}</div>
    </div>
  );
}

export default function Debug() {
  const [session, setSession] = useState<SessionSnapshot>({
    userId: null,
    email: null,
    authenticated: false,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSession({
        userId: data.user?.id ?? null,
        email: data.user?.email ?? null,
        authenticated: !!data.user,
      });
    });
  }, []);

  const env = import.meta.env;
  const IS_MOCK = env.VITE_CHAT_MOCK === '1';

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* Header with mode badges */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Debug</h1>
          <div className="flex gap-2">
            {IS_TEST && (
              <span className="text-xs text-yellow-400 px-2 py-0.5 rounded border border-yellow-400/30 bg-yellow-400/10">
                Test Mode
              </span>
            )}
            {IS_MOCK && (
              <span className="text-xs text-blue-400 px-2 py-0.5 rounded border border-blue-400/30 bg-blue-400/10">
                Mock Mode
              </span>
            )}
          </div>
        </div>

        {/* Environment Variables */}
        <div className="rounded-2xl border border-white/10 bg-stone-900 p-4">
          <h2 className="text-lg font-semibold mb-3">Environment</h2>
          <div className="space-y-1">
            <Row label="APP_MODE" value={env.VITE_APP_MODE || "not set"} />
            <Row label="CHAT_MOCK" value={IS_MOCK ? "ON" : "OFF"} />
            <Row label="SUPABASE_URL" value={env.VITE_SUPABASE_URL ? "✅ set" : "❌ missing"} />
            <Row label="SUPABASE_ANON_KEY" value={env.VITE_SUPABASE_ANON_KEY ? "✅ set" : "❌ missing"} />
          </div>
        </div>

        {/* Session Snapshot */}
        <div className="rounded-2xl border border-white/10 bg-stone-900 p-4">
          <h2 className="text-lg font-semibold mb-3">Session Snapshot</h2>
          <div className="space-y-1">
            <Row label="Authenticated" value={session.authenticated ? "✅ Yes" : "❌ No"} />
            <Row label="User ID" value={session.userId || "none"} />
            <Row label="Email" value={session.email || "none"} />
          </div>
        </div>

        {/* Runtime Checks */}
        <div className="rounded-2xl border border-white/10 bg-stone-900 p-4 space-y-3">
          <h2 className="text-lg font-semibold">Runtime Checks</h2>
          <ul className="list-disc pl-5 text-sm text-stone-300 space-y-1">
            <li>React rendering: ✅ OK</li>
            <li>Test mode: {IS_TEST ? "✅ ON" : "OFF"}</li>
            <li>Mock mode: {IS_MOCK ? "✅ ON" : "OFF"}</li>
            <li>Supabase client: {env.VITE_SUPABASE_URL ? "✅ configured" : "❌ not configured"}</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
