// Purpose: Return paginated notes in a folder
// Migrated from: /api/folders/notes
// Features: Cursor-based pagination, RLS enforcement

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';

export async function folder_notes(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, req } = context;

  // Get folder_id, cursor, and limit from query
  const { folder_id, cursor, limit: limitParam } = req.query;

  if (!folder_id || typeof folder_id !== 'string') {
    throw {
      code: 'MISSING_FOLDER_ID',
      message: 'folder_id query parameter is required',
      status: 400
    };
  }

  // Parse limit (default 20, max 100)
  let limit = 20;
  if (limitParam && typeof limitParam === 'string') {
    const parsedLimit = parseInt(limitParam, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
      limit = parsedLimit;
    }
  }

  // Create Supabase client with user token
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  );

  // Verify folder exists and user has access
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id')
    .eq('id', folder_id)
    .single();

  if (folderError || !folder) {
    throw {
      code: 'FOLDER_NOT_FOUND',
      message: 'Folder not found or you don\'t have access',
      status: 404
    };
  }

  // Fetch notes in this folder
  let query = supabase
    .from('notes')
    .select(
      `
      id,
      user_id,
      class_id,
      title,
      source_type,
      path,
      content,
      created_at,
      note_folders!inner(folder_id)
    `
    )
    .eq('note_folders.folder_id', folder_id)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // Fetch one extra to check if there's more

  // Apply cursor if provided (created_at for pagination)
  if (cursor && typeof cursor === 'string') {
    query = query.lt('created_at', cursor);
  }

  const { data: notes, error: notesError } = await query;

  if (notesError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'folder_notes',
        folder_id,
        error: notesError.message,
        message: 'Failed to fetch notes'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch notes',
      status: 500
    };
  }

  // Check if there are more results
  const hasMore = notes && notes.length > limit;
  const notesToReturn = hasMore ? notes.slice(0, limit) : notes || [];

  // Next cursor is the created_at of the last note
  const nextCursor = hasMore && notesToReturn.length > 0
    ? notesToReturn[notesToReturn.length - 1].created_at
    : null;

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_notes',
      folder_id,
      note_count: notesToReturn.length,
      has_more: hasMore,
      message: 'Folder notes retrieved'
    })
  );

  return {
    notes: notesToReturn,
    cursor: nextCursor,
    has_more: hasMore,
  };
}
