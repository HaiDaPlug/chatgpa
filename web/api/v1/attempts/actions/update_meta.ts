// Purpose: Update attempt metadata action (gateway action)
// Migrated from: /api/attempts/meta.ts
// Connects to: quiz_attempts table

import { createClient } from '@supabase/supabase-js';
import type { GatewayContext } from '../../_types';
import { UpdateMetaInput, type UpdateMetaOutputType } from '../schemas';

/**
 * Update Meta Action
 * Updates attempt title and/or subject (inline editing)
 * Features:
 * - Editable title and subject
 * - Increments autosave_version for consistency with conflict resolution
 * - updated_at auto-touched by DB trigger
 * - Works for both in_progress and submitted attempts
 */
export async function update_meta(
  data: unknown,
  context: GatewayContext
): Promise<UpdateMetaOutputType> {
  const { request_id, token, user_id } = context;

  // 1. Validate input
  const parse = UpdateMetaInput.safeParse(data);
  if (!parse.success) {
    const firstError = parse.error.issues[0];
    throw {
      code: 'SCHEMA_INVALID',
      message: firstError?.message ?? 'Invalid request data',
      status: 400
    };
  }

  const { attempt_id, title, subject } = parse.data;

  // 2. Create Supabase client with user token (RLS)
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    }
  );

  // 3. Verify attempt exists and user owns it (RLS will enforce this)
  const { data: attemptData, error: fetchError } = await supabase
    .from('quiz_attempts')
    .select('id, autosave_version, title, subject')
    .eq('id', attempt_id)
    .eq('user_id', user_id!)
    .single();

  if (fetchError || !attemptData) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'update_meta',
        attempt_id,
        message: 'Attempt not found or access denied'
      })
    );
    throw {
      code: 'NOT_FOUND',
      message: 'Attempt not found or access denied',
      status: 404
    };
  }

  // 4. Build update object (only update provided fields)
  const updates: any = {
    autosave_version: attemptData.autosave_version + 1 // Bump version for consistency
  };

  if (title !== undefined) {
    updates.title = title;
  }

  if (subject !== undefined) {
    updates.subject = subject;
  }

  // 5. Update attempt metadata
  // Note: updated_at is auto-touched by the DB trigger
  const { data: updatedAttempt, error: updateError } = await supabase
    .from('quiz_attempts')
    .update(updates)
    .eq('id', attempt_id)
    .eq('user_id', user_id!) // Double-check ownership (RLS should handle this)
    .select('id, title, subject, autosave_version, updated_at')
    .single();

  if (updateError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'update_meta',
        attempt_id,
        error: updateError.message,
        error_code: updateError.code,
        message: 'Failed to update attempt metadata'
      })
    );
    throw {
      code: 'SERVER_ERROR',
      message: 'Failed to update attempt metadata',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      user_id,
      action: 'update_meta',
      attempt_id,
      old_title: attemptData.title,
      new_title: updatedAttempt.title,
      old_subject: attemptData.subject,
      new_subject: updatedAttempt.subject,
      autosave_version: updatedAttempt.autosave_version,
      message: 'Metadata updated successfully'
    })
  );

  return {
    ok: true,
    title: updatedAttempt.title,
    subject: updatedAttempt.subject,
    autosave_version: updatedAttempt.autosave_version,
    updated_at: updatedAttempt.updated_at
  };
}
