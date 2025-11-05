// Purpose: Usage plan enforcement helper
// Provides: getUserPlan(), getQuizCount()
// Used by: generate-quiz.ts to enforce free tier limits before OpenAI call

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Determines user's subscription tier
 * @returns { tier: "free" } or { tier: "paid", plan: "monthly" | "annual" | null }
 */
export async function getUserPlan(supabase: SupabaseClient, user_id: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, plan")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { tier: "free" as const };

  // Active or trialing subscriptions count as paid
  if (data.status === "active" || data.status === "trialing") {
    return { tier: "paid" as const, plan: data.plan ?? null };
  }

  return { tier: "free" as const };
}

/**
 * Counts total quizzes created by user (RLS-protected)
 * @returns { count: number, ok: boolean }
 */
export async function getQuizCount(supabase: SupabaseClient, user_id: string) {
  const { count, error } = await supabase
    .from("quizzes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user_id);

  if (error) {
    console.error("GET_QUIZ_COUNT_ERROR", { user_id, error });
    return { count: 0, ok: false };
  }

  return { count: count ?? 0, ok: true };
}
