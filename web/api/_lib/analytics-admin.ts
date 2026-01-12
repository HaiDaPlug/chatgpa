// Purpose: Shared admin client for analytics inserts (service role)
// Server-side only, never exposed to client

import { createClient } from "@supabase/supabase-js";

// Module-level cached admin client (avoids recreating on every insert)
let _analyticsAdminClient: ReturnType<typeof createClient> | null = null;
let _envCheckLogged = false;

/**
 * Get or create analytics admin client (service role).
 * Cached at module scope to avoid connection pool churn.
 * Server-side only, never exposed to client.
 *
 * @returns Supabase client with service role (bypasses RLS) or null if env missing
 */
export function getAnalyticsAdminClient() {
  // Lazy init + cache
  if (_analyticsAdminClient) {
    return _analyticsAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Warn once per cold start if missing (detailed diagnostic)
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (!_envCheckLogged) {
      const missingVars = [];
      if (!supabaseUrl) missingVars.push("SUPABASE_URL");
      if (!supabaseServiceRoleKey) missingVars.push("SUPABASE_SERVICE_ROLE_KEY");

      console.warn("ANALYTICS_ADMIN_CLIENT_DISABLED", {
        missing_env_vars: missingVars,
        deployment_env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        note: "Analytics inserts will be silently skipped",
      });
      _envCheckLogged = true;
    }
    return null;
  }

  _analyticsAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return _analyticsAdminClient;
}
