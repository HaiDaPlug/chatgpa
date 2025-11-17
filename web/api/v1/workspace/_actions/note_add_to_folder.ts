// Purpose: Add a note to a folder (removes previous mapping if exists)
// Migrated from: /api/notes/add-to-folder
// Features: Class mismatch validation, UPSERT for race conditions, RLS enforcement

import type { GatewayContext } from '../../_types.js';
import { createClient } from '@supabase/supabase-js';
import { NoteAddToFolderInput } from '../_schemas.js';

export async function note_add_to_folder(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, user_id } = context;

  // Validate input
  const parseResult = NoteAddToFolderInput.safeParse(data);
  if (!parseResult.success) {
    throw {
      code: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input',
      status: 400
    };
  }

  const { note_id, folder_id } = parseResult.data;

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

  // Fetch note (verifies ownership via RLS)
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('id, class_id')
    .eq('id', note_id)
    .single();

  if (noteError || !note) {
    throw {
      code: 'NOTE_NOT_FOUND',
      message: 'Note not found or you don\'t have access',
      status: 404
    };
  }

  // Fetch folder (verifies ownership via RLS)
  const { data: folder, error: folderError } = await supabase
    .from('folders')
    .select('id, class_id')
    .eq('id', folder_id)
    .single();

  if (folderError || !folder) {
    throw {
      code: 'FOLDER_NOT_FOUND',
      message: 'Folder not found or you don\'t have access',
      status: 404
    };
  }

  // Verify note and folder belong to same class
  if (note.class_id !== folder.class_id) {
    throw {
      code: 'CLASS_MISMATCH',
      message: 'Note and folder must belong to the same class',
      status: 400
    };
  }

  // Check if note already has a mapping in this class (app-level guard)
  const { data: existingMappings, error: mappingsError } = await supabase
    .from('note_folders')
    .select('folder_id, folders!inner(class_id)')
    .eq('note_id', note_id);

  if (!mappingsError && existingMappings) {
    // Filter to same class
    const sameClassMappings = existingMappings.filter(
      (m: any) => m.folders.class_id === note.class_id
    );

    // If already mapped to a folder in this class, remove old mapping
    if (sameClassMappings.length > 0) {
      const oldFolderIds = sameClassMappings.map((m: any) => m.folder_id);

      const { error: deleteError } = await supabase
        .from('note_folders')
        .delete()
        .eq('note_id', note_id)
        .in('folder_id', oldFolderIds);

      if (deleteError) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            request_id,
            action: 'note_add_to_folder',
            note_id,
            oldFolderIds,
            error: deleteError.message,
            message: 'Failed to delete old mapping (continuing anyway)'
          })
        );
        // Continue anyway - insert might work
      }
    }
  }

  // Insert new mapping (UPSERT to handle race conditions)
  const { data: mapping, error: insertError } = await supabase
    .from('note_folders')
    .upsert(
      {
        note_id,
        folder_id,
        user_id,
      },
      {
        onConflict: 'note_id, folder_id',
      }
    )
    .select()
    .single();

  if (insertError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'note_add_to_folder',
        user_id,
        note_id,
        folder_id,
        error: insertError.message,
        message: 'Failed to add note to folder'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to add note to folder',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'note_add_to_folder',
      user_id,
      note_id,
      folder_id,
      message: 'Note added to folder successfully'
    })
  );

  return {
    ok: true,
  };
}
