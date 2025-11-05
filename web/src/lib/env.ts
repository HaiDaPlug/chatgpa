// Centralized env access (client + server-safe where applicable).
// Use: const VITE_SUPABASE_URL = env("VITE_SUPABASE_URL"); // throws if missing
export function env(name: string, fallback?: string): string {
  const v = import.meta?.env?.[name] ?? (typeof process !== "undefined" ? process.env?.[name] : undefined);
  if (v && String(v).trim().length > 0) return String(v);
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${name}`);
}

// Optional model helper with safe default
export function modelEnv(name: string, fallback: string = "gpt-4o-mini"): string {
  const v = import.meta?.env?.[name] ?? (typeof process !== "undefined" ? process.env?.[name] : undefined);
  return (v && String(v).trim().length > 0) ? String(v) : fallback;
}
