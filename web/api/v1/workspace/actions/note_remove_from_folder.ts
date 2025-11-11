// Purpose: Remove a note from a folder (note becomes uncategorized)
// Migrated from: /api/notes/remove-from-folder
// Features: Mapping verification, RLS enforcement

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';

export async function note_remove_from_folder(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, user_id, req } = context;

  // Get note_id and folder_id from query
  const { note_id, folder_id } = req.query;

  if (!note_id || typeof note_id !== 'string') {
    throw {
      code: 'MISSING_NOTE_ID',
      message: 'note_id query parameter is required',
      status: 400
    };
  }

  if (!folder_id || typeof folder_id !== 'string') {
    throw {
      code: 'MISSING_FOLDER_ID',
      message: 'folder_id query parameter is required',
      status: 400
    };
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

  // Verify mapping exists and user owns it (RLS will also enforce)
  const { data: mapping, error: fetchError } = await supabase
    .from('note_folders')
    .select('note_id, folder_id')
    .eq('note_id', note_id)
    .eq('folder_id', folder_id)
    .single();

  if (fetchError || !mapping) {
    throw {
      code: 'MAPPING_NOT_FOUND',
      message: 'Note-folder mapping not found or you don\'t have access',
      status: 404
    };
  }

  // Delete the mapping
  const { error: deleteError } = await supabase
    .from('note_folders')
    .delete()
    .eq('note_id', note_id)
    .eq('folder_id', folder_id);

  if (deleteError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'note_remove_from_folder',
        user_id,
        note_id,
        folder_id,
        error: deleteError.message,
        message: 'Failed to remove note from folder'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to remove note from folder',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'note_remove_from_folder',
      user_id,
      note_id,
      folder_id,
      message: 'Note removed from folder successfully'
    })
  );

  return {
    ok: true,
  };
}
