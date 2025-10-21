// src/lib/spendTokens.ts
import { supabase } from './supabase';

export type SpendResult = {
  ok: boolean;
  reason?: 'insufficient_funds' | 'no_balance' | 'non_positive_spend' | 'error';
  after?: {
    personal_tokens: number;
    reserve_tokens: number;
    pool_bonus_tokens: number;
  };
  error?: string;
};

/**
 * Spend tokens using the V15 spend_tokens RPC
 * @param userId - User UUID
 * @param tokens - Number of tokens to spend (must be positive)
 * @param messageId - Optional message ID for tracking
 * @param model - Optional model name
 * @param meta - Optional metadata object
 * @returns SpendResult with ok status and updated balances
 */
export async function spendTokens(
  userId: string,
  tokens: number,
  messageId?: string,
  model?: string,
  meta?: Record<string, any>
): Promise<SpendResult> {
  try {
    if (tokens <= 0) {
      return { ok: false, reason: 'non_positive_spend' };
    }

    const { data, error } = await supabase.rpc('spend_tokens', {
      p_user_id: userId,
      p_tokens: tokens,
      p_message_id: messageId || null,
      p_model: model || null,
      p_meta: meta || {},
    });

    if (error) {
      console.error('spendTokens RPC error:', error);
      return { ok: false, reason: 'error', error: error.message };
    }

    // Parse the JSONB response from the RPC
    const result = data as { ok: boolean; reason?: string; after?: any };

    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason as any,
      };
    }

    return {
      ok: true,
      after: result.after,
    };
  } catch (err: any) {
    console.error('spendTokens exception:', err);
    return { ok: false, reason: 'error', error: err?.message || 'Unknown error' };
  }
}
