import { createClient } from "@supabase/supabase-js";

// Reuse your existing client setup if you already have one
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

// ----------- RPC WRAPPERS -----------

// Spend tokens (user → deduct from ledger)
export async function spendTokens(userId: string, amount: number) {
  const { data, error } = await supabase.rpc("spend_tokens", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) throw error;
  return data; // { ok: true, personal, reserve, community_bonus } OR { ok: false, remaining }
}

// Monthly allocation (Stripe webhook only — don’t call from frontend)
// Keep here for testing/admin use
export async function applyMonthlyAllocation(
  userId: string,
  personal: number,
  poolContrib: number
) {
  const { data, error } = await supabase.rpc("apply_monthly_allocation", {
    p_user_id: userId,
    p_personal: personal,
    p_pool_contrib: poolContrib,
  });

  if (error) throw error;
  return data;
}

// Monthly rollover (cron/admin only)
export async function monthlyRollover() {
  const { data, error } = await supabase.rpc("monthly_rollover", {});
  if (error) throw error;
  return data;
}
