// Purpose: Start/resume attempt action (gateway action)
// Migrated from: /api/attempts/start.ts
// Connects to: quiz_attempts table

import { createClient } from '@supabase/supabase-js';
import type { GatewayContext } from '../../_types.js';
import { StartInput, type StartOutputType } from '../_schemas.js';

/**
 * Start Action
 * Creates a new in_progress attempt for a quiz
 * Features:
 * - Idempotent (returns existing in_progress attempt if found)
 * - Enforces one in_progress attempt per quiz/user (DB constraint)
 * - Copies quiz title/subject → attempt title/subject
 * - Race-safe (handles double-clicks gracefully)
 */
export async function start(
  data: unknown,
  context: GatewayContext
): Promise<StartOutputType> {
  const { request_id, token, user_id } = context;

  // 1. Validate input
  const parse = StartInput.safeParse(data);
  if (!parse.success) {
    const firstError = parse.error.issues[0];
    throw {
      code: 'SCHEMA_INVALID',
      message: firstError?.message ?? 'Invalid request data',
      status: 400
    };
  }

  const { quiz_id, idempotency_key } = parse.data;

  // 2. Create Supabase client with user token (RLS)
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false }
    }
  );

  // 3. Check if quiz exists and user has access (RLS handles this)
  const { data: quizData, error: quizError } = await supabase
    .from('quizzes')
    .select('id, class_id, title, subject')
    .eq('id', quiz_id)
    .single();

  if (quizError || !quizData) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'start',
        quiz_id,
        message: 'Quiz not found or access denied'
      })
    );
    throw {
      code: 'NOT_FOUND',
      message: 'Quiz not found or access denied',
      status: 404
    };
  }

  // 4. Check for existing in_progress attempt (idempotency)
  const { data: existingAttempt, error: checkError } = await supabase
    .from('quiz_attempts')
    .select('id, status, title, subject, started_at, updated_at, autosave_version')
    .eq('quiz_id', quiz_id)
    .eq('user_id', user_id!)
    .eq('status', 'in_progress')
    .maybeSingle(); // Use maybeSingle() to avoid error if no rows

  if (existingAttempt) {
    // Return existing attempt (idempotent behavior)
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        request_id,
        user_id,
        action: 'start',
        quiz_id,
        attempt_id: existingAttempt.id,
        idempotent: true,
        message: 'Returning existing in_progress attempt'
      })
    );

    return {
      attempt_id: existingAttempt.id,
      status: 'in_progress',
      title: existingAttempt.title,
      subject: existingAttempt.subject,
      started_at: existingAttempt.started_at,
      updated_at: existingAttempt.updated_at,
      autosave_version: existingAttempt.autosave_version,
      resumed: true // Flag indicating this is a resume, not a new start
    };
  }

  // 5. Create new in_progress attempt
  // Copy title/subject from quiz (user can edit later)
  const { data: attemptData, error: insertError } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id,
      user_id: user_id!,
      class_id: quizData.class_id,
      title: quizData.title || `Quiz Attempt — ${new Date().toLocaleDateString()}`,
      subject: quizData.subject || 'General',
      status: 'in_progress',
      responses: {}, // Empty responses initially
      autosave_version: 0
    })
    .select('id, status, title, subject, started_at, updated_at, autosave_version')
    .single();

  if (insertError) {
    // Check if error is due to unique constraint (race condition)
    if (insertError.code === '23505') {
      // Unique constraint violation - another request created it first
      // Try fetching the existing attempt
      const { data: racedAttempt } = await supabase
        .from('quiz_attempts')
        .select('id, status, title, subject, started_at, updated_at, autosave_version')
        .eq('quiz_id', quiz_id)
        .eq('user_id', user_id!)
        .eq('status', 'in_progress')
        .single();

      if (racedAttempt) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            request_id,
            user_id,
            action: 'start',
            quiz_id,
            attempt_id: racedAttempt.id,
            race_condition: true,
            message: 'Race condition detected, returning existing attempt'
          })
        );

        return {
          attempt_id: racedAttempt.id,
          status: 'in_progress',
          title: racedAttempt.title,
          subject: racedAttempt.subject,
          started_at: racedAttempt.started_at,
          updated_at: racedAttempt.updated_at,
          autosave_version: racedAttempt.autosave_version,
          resumed: true
        };
      }
    }

    // Other insert errors
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        user_id,
        action: 'start',
        quiz_id,
        error: insertError.message,
        error_code: insertError.code,
        message: 'Failed to create attempt'
      })
    );
    throw {
      code: 'SERVER_ERROR',
      message: 'Failed to create attempt',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      user_id,
      action: 'start',
      quiz_id,
      attempt_id: attemptData.id,
      message: 'Attempt created successfully'
    })
  );

  return {
    attempt_id: attemptData.id,
    status: 'in_progress',
    title: attemptData.title,
    subject: attemptData.subject,
    started_at: attemptData.started_at,
    updated_at: attemptData.updated_at,
    autosave_version: attemptData.autosave_version,
    resumed: false // New attempt, not a resume
  };
}
