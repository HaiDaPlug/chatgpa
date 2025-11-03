// Vite SPA client (no SSR). Single responsibility: export `supabase`.
import { createClient } from "@supabase/supabase-js";

function getEnv(name: string) {
  const v = (import.meta as any).env?.[name] as string | undefined;
  if (!v) throw new Error(`[supabase] Missing ${name}. Add it to .env.local and restart Vite.`);
  return v;
}

const URL = getEnv("VITE_SUPABASE_URL").replace(/\/+$/, "");
const ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(URL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
