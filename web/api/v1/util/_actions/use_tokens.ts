// Purpose: Spend tokens from usage limits
// Migrated from: /api/use-tokens
// Features: Uses SERVICE_ROLE_KEY for RPC, checks balance, 402 on insufficient

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';
import { UseTokensInput } from '../_schemas';

export async function use_tokens(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id } = context;

  // Validate input
  const parseResult = UseTokensInput.safeParse(data);
  if (!parseResult.success) {
    throw {
      code: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid userId or tokens',
      status: 400
    };
  }

  const { userId, tokens } = parseResult.data;

  if (tokens <= 0) {
    throw {
      code: 'INVALID_INPUT',
      message: 'tokens must be positive',
      status: 400
    };
  }

  // Create Supabase client with SERVICE_ROLE_KEY for RPC access
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // spend_tokens returns { ok: boolean, remaining?: number, personal?: number, reserve?: number, community_bonus?: number }
  const { data: result, error } = await supabase.rpc('spend_tokens', {
    p_user_id: userId,
    p_amount: tokens,
  });

  if (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'use_tokens',
        userId: userId.substring(0, 8) + '...',
        tokens,
        error: error.message,
        message: 'Token spending failed'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: error.message,
      status: 400
    };
  }

  if (!result?.ok) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        request_id,
        action: 'use_tokens',
        userId: userId.substring(0, 8) + '...',
        tokens,
        remaining: result?.remaining ?? 0,
        message: 'Insufficient tokens'
      })
    );
    throw {
      code: 'OUT_OF_TOKENS',
      message: 'out_of_tokens',
      status: 402,
      remaining: result?.remaining ?? 0
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'use_tokens',
      userId: userId.substring(0, 8) + '...',
      tokens,
      remaining: result.remaining,
      message: 'Tokens spent successfully'
    })
  );

  return result;
}
