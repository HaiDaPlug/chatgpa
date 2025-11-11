// Purpose: Return notes without folder mapping (uncategorized notes)
// Migrated from: /api/classes/notes-uncategorized
// Features: Cursor-based pagination, RLS enforcement

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';

export async function notes_uncategorized(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, req } = context;

  // Get class_id, cursor, and limit from query
  const { class_id, cursor, limit: limitParam } = req.query;

  if (!class_id || typeof class_id !== 'string') {
    throw {
      code: 'MISSING_CLASS_ID',
      message: 'class_id query parameter is required',
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

  // Verify class exists and user has access
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('id', class_id)
    .single();

  if (classError || !classData) {
    throw {
      code: 'CLASS_NOT_FOUND',
      message: 'Class not found or you don\'t have access',
      status: 404
    };
  }

  // Fetch all note_folders mappings for this class to exclude
  const { data: mappedNotes, error: mappingsError } = await supabase
    .from('note_folders')
    .select('note_id, folders!inner(class_id)')
    .eq('folders.class_id', class_id);

  if (mappingsError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'notes_uncategorized',
        class_id,
        error: mappingsError.message,
        message: 'Failed to fetch note mappings'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch note mappings',
      status: 500
    };
  }

  // Build list of mapped note IDs
  const mappedNoteIds = new Set(
    (mappedNotes || []).map((m: any) => m.note_id)
  );

  // Fetch all notes for this class
  let query = supabase
    .from('notes')
    .select('id, user_id, class_id, title, source_type, path, content, created_at')
    .eq('class_id', class_id)
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Fetch extra to account for filtering

  // Apply cursor if provided
  if (cursor && typeof cursor === 'string') {
    query = query.lt('created_at', cursor);
  }

  const { data: allNotes, error: notesError } = await query;

  if (notesError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'notes_uncategorized',
        class_id,
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

  // Filter out mapped notes
  const uncategorizedNotes = (allNotes || []).filter(
    (note) => !mappedNoteIds.has(note.id)
  );

  // Apply limit
  const hasMore = uncategorizedNotes.length > limit;
  const notesToReturn = hasMore
    ? uncategorizedNotes.slice(0, limit)
    : uncategorizedNotes;

  // Next cursor is the created_at of the last note
  const nextCursor = hasMore && notesToReturn.length > 0
    ? notesToReturn[notesToReturn.length - 1].created_at
    : null;

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'notes_uncategorized',
      class_id,
      note_count: notesToReturn.length,
      has_more: hasMore,
      message: 'Uncategorized notes retrieved'
    })
  );

  return {
    notes: notesToReturn,
    cursor: nextCursor,
    has_more: hasMore,
  };
}
