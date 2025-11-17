// Purpose: Free tier usage limit enforcement (live counts)
// Connects to: /api/generate-quiz

import { SupabaseClient } from '@supabase/supabase-js';
import { Result, ok, err, ErrorCode } from './validation.js';

// Free tier limits
const FREE_TIER_LIMITS = {
  MAX_CLASSES: 1,
  MAX_QUIZZES: 5, // quizzes created (not taken)
};

/**
 * Check if user can create a new class (live count from classes table)
 */
export async function canCreateClass(
  supabase: SupabaseClient,
  userId: string
): Promise<Result<boolean>> {
  // Check subscription tier
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .single();

  // If paid tier, allow
  if (sub && sub.tier !== 'free' && sub.status === 'active') {
    return ok(true);
  }

  // Compute live count from classes table
  const { count, error: countError } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    return err(ErrorCode.SERVER_ERROR, 'Failed to check class limits');
  }

  if ((count || 0) >= FREE_TIER_LIMITS.MAX_CLASSES) {
    return err(
      ErrorCode.LIMIT_EXCEEDED,
      `Free tier limit: ${FREE_TIER_LIMITS.MAX_CLASSES} class maximum. Upgrade to create more classes.`
    );
  }

  return ok(true);
}

/**
 * Check if user can generate a new quiz (live count from quizzes table)
 */
export async function canGenerateQuiz(
  supabase: SupabaseClient,
  userId: string
): Promise<Result<boolean>> {
  // Check subscription tier
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .single();

  // If paid tier, allow
  if (sub && sub.tier !== 'free' && sub.status === 'active') {
    return ok(true);
  }

  // Compute live count from quizzes table (created, not taken)
  const { count, error: countError } = await supabase
    .from('quizzes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    return err(ErrorCode.SERVER_ERROR, 'Failed to check quiz limits');
  }

  if ((count || 0) >= FREE_TIER_LIMITS.MAX_QUIZZES) {
    return err(
      ErrorCode.LIMIT_EXCEEDED,
      `Free tier limit: ${FREE_TIER_LIMITS.MAX_QUIZZES} quizzes maximum. Upgrade for unlimited quizzes.`
    );
  }

  return ok(true);
}

/**
 * Optional: Update usage_limits cache after successful insert
 * This is a cache only - source of truth is live counts
 */
export async function updateUsageCache(
  supabase: SupabaseClient,
  userId: string,
  quizCount: number
): Promise<void> {
  await supabase
    .from('usage_limits')
    .upsert(
      {
        user_id: userId,
        quizzes_taken: quizCount,
      },
      { onConflict: 'user_id' }
    );
}
