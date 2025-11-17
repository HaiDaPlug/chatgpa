// Purpose: Autosave attempt action (gateway action)
// Migrated from: /api/attempts/autosave.ts
// Connects to: quiz_attempts table

import { createClient } from '@supabase/supabase-js';
import type { GatewayContext } from '../../_types.js';
import { AutosaveInput, type AutosaveOutputType } from '../_schemas.js';

// Max payload size: 500KB (in bytes)
const MAX_PAYLOAD_SIZE = 500 * 1024;

/**
 * Autosave Action
 * Saves user answers to an in_progress attempt
 * Features:
 * - Request size limit (500KB) to prevent abuse
 * - Increments autosave_version for conflict resolution
 * - updated_at auto-touched by DB trigger
 * - Fire-and-forget from client (non-blocking)
 */
export async function autosave(
  data: unknown,
  context: GatewayContext
): Promise<AutosaveOutputType> {
  const { request_id, token, user_id } = context;

  // 1. Check payload size (prevent large autosaves from bloating DB)
  const bodyString = JSON.stringify(data);
  if (Buffer.byteLength(bodyString, 'utf8') > MAX_PAYLOAD_SIZE) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        request_id,
        user_id,
        action: 'autosave',
        payload_size: Buffer.byteLength(bodyString, 'utf8'),
        max_size: MAX_PAYLOAD_SIZE,
        message: 'Payload too large'
      })
    );

    throw {
      code: 'PAYLOAD_TOO_LARGE',
      message: `Autosave payload exceeds maximum size of ${MAX_PAYLOAD_SIZE / 1024}KB`,
      status: 413
    };
  }

  // 2. Validate input
  const parse = AutosaveInput.safeParse(data);
  if (!parse.success) {
    const firstError = parse.error.issues[0];
    throw {
      code: 'SCHEMA_INVALID',
      message: firstError?.message ?? 'Invalid request data',
      status: 400
    };
  }

  const { attempt_id, responses } = parse.data;

  // 3. Create Supabase client with user token (RLS)
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    }
  );

  // 4. Verify attempt exists, is in_progress, and user owns it (RLS will enforce this)
  const { data: attemptData, error: fetchError } = await supabase
    .from('quiz_attempts')
    .select('id, status, autosave_version')
    .eq('id', attempt_id)
    .eq('user_id', user_id!)
    .eq('status', 'in_progress')
    .single();

  if (fetchError || !attemptData) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'autosave',
        attempt_id,
        message: 'Attempt not found, already submitted, or access denied'
      })
    );
    throw {
      code: 'NOT_FOUND',
      message: 'Attempt not found, already submitted, or access denied',
      status: 404
    };
  }

  // 5. Update attempt with new responses and increment autosave_version
  // Note: updated_at is auto-touched by the DB trigger
  const { data: updatedAttempt, error: updateError } = await supabase
    .from('quiz_attempts')
    .update({
      responses,
      autosave_version: attemptData.autosave_version + 1
    })
    .eq('id', attempt_id)
    .eq('user_id', user_id!) // Double-check ownership (RLS should handle this)
    .select('id, autosave_version, updated_at')
    .single();

  if (updateError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'autosave',
        attempt_id,
        error: updateError.message,
        error_code: updateError.code,
        message: 'Failed to autosave attempt'
      })
    );
    throw {
      code: 'SERVER_ERROR',
      message: 'Failed to autosave attempt',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      user_id,
      action: 'autosave',
      attempt_id,
      autosave_version: updatedAttempt.autosave_version,
      response_count: Object.keys(responses).length,
      message: 'Autosave successful'
    })
  );

  return {
    ok: true,
    autosave_version: updatedAttempt.autosave_version,
    updated_at: updatedAttempt.updated_at
  };
}
