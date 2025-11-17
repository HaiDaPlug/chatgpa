// Purpose: Delete folder with cascade options
// Migrated from: /api/folders/delete
// Features: Cascade modes (move-to-parent, move-to-uncategorized), RLS enforcement

import type { GatewayContext } from '../../_types.js';
import { createClient } from '@supabase/supabase-js';

type CascadeMode = 'move-to-parent' | 'move-to-uncategorized';

export async function folder_delete(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, user_id, req } = context;

  // Get folder_id and cascade from query
  const { folder_id, cascade } = req.query;

  if (!folder_id || typeof folder_id !== 'string') {
    throw {
      code: 'MISSING_FOLDER_ID',
      message: 'folder_id query parameter is required',
      status: 400
    };
  }

  // Validate cascade parameter if provided
  let cascadeMode: CascadeMode | null = null;
  if (cascade) {
    if (cascade === 'move-to-parent' || cascade === 'move-to-uncategorized') {
      cascadeMode = cascade;
    } else {
      throw {
        code: 'INVALID_CASCADE',
        message: 'cascade must be \'move-to-parent\' or \'move-to-uncategorized\'',
        status: 400
      };
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

  // Fetch folder (verifies ownership via RLS)
  const { data: folder, error: fetchError } = await supabase
    .from('folders')
    .select('id, parent_id, class_id')
    .eq('id', folder_id)
    .single();

  if (fetchError || !folder) {
    throw {
      code: 'FOLDER_NOT_FOUND',
      message: 'Folder not found or you don\'t have access',
      status: 404
    };
  }

  // Check if folder has children
  const { data: children, error: childrenError } = await supabase
    .from('folders')
    .select('id')
    .eq('parent_id', folder_id)
    .limit(1);

  const hasChildren = !childrenError && children && children.length > 0;

  // Check if folder has notes
  const { data: notes, error: notesError } = await supabase
    .from('note_folders')
    .select('note_id')
    .eq('folder_id', folder_id)
    .limit(1);

  const hasNotes = !notesError && notes && notes.length > 0;

  // If folder is not empty and no cascade mode, reject
  if ((hasChildren || hasNotes) && !cascadeMode) {
    throw {
      code: 'FOLDER_NOT_EMPTY',
      message: 'Folder is not empty. Use cascade parameter to move contents before deleting.',
      status: 409
    };
  }

  // If cascade mode, handle contents
  if (cascadeMode) {
    if (cascadeMode === 'move-to-parent') {
      // Move child folders to parent (or null if this is root-level)
      if (hasChildren) {
        const { error: moveChildrenError } = await supabase
          .from('folders')
          .update({ parent_id: folder.parent_id })
          .eq('parent_id', folder_id);

        if (moveChildrenError) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              request_id,
              action: 'folder_delete',
              folder_id,
              error: moveChildrenError.message,
              message: 'Failed to move child folders'
            })
          );
          throw {
            code: 'DATABASE_ERROR',
            message: 'Failed to move child folders',
            status: 500
          };
        }
      }

      // Move notes to parent folder (or remove mapping if no parent)
      if (hasNotes) {
        if (folder.parent_id) {
          // Update note_folders to point to parent
          const { error: moveNotesError } = await supabase
            .from('note_folders')
            .update({ folder_id: folder.parent_id })
            .eq('folder_id', folder_id);

          if (moveNotesError) {
            console.error(
              JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'error',
                request_id,
                action: 'folder_delete',
                folder_id,
                error: moveNotesError.message,
                message: 'Failed to move notes'
              })
            );
            throw {
              code: 'DATABASE_ERROR',
              message: 'Failed to move notes',
              status: 500
            };
          }
        } else {
          // No parent - delete mappings (notes become uncategorized)
          const { error: deleteNotesError } = await supabase
            .from('note_folders')
            .delete()
            .eq('folder_id', folder_id);

          if (deleteNotesError) {
            console.error(
              JSON.stringify({
                timestamp: new Date().toISOString(),
                level: 'error',
                request_id,
                action: 'folder_delete',
                folder_id,
                error: deleteNotesError.message,
                message: 'Failed to remove note mappings'
              })
            );
            throw {
              code: 'DATABASE_ERROR',
              message: 'Failed to remove note mappings',
              status: 500
            };
          }
        }
      }
    } else if (cascadeMode === 'move-to-uncategorized') {
      // Move child folders to root (parent_id = null)
      if (hasChildren) {
        const { error: moveChildrenError } = await supabase
          .from('folders')
          .update({ parent_id: null })
          .eq('parent_id', folder_id);

        if (moveChildrenError) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              request_id,
              action: 'folder_delete',
              folder_id,
              error: moveChildrenError.message,
              message: 'Failed to move child folders to root'
            })
          );
          throw {
            code: 'DATABASE_ERROR',
            message: 'Failed to move child folders to root',
            status: 500
          };
        }
      }

      // Delete note mappings (notes become uncategorized)
      if (hasNotes) {
        const { error: deleteNotesError } = await supabase
          .from('note_folders')
          .delete()
          .eq('folder_id', folder_id);

        if (deleteNotesError) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              request_id,
              action: 'folder_delete',
              folder_id,
              error: deleteNotesError.message,
              message: 'Failed to remove note mappings'
            })
          );
          throw {
            code: 'DATABASE_ERROR',
            message: 'Failed to remove note mappings',
            status: 500
          };
        }
      }
    }
  }

  // Delete the folder (CASCADE will handle note_folders if any remain)
  const { error: deleteError } = await supabase
    .from('folders')
    .delete()
    .eq('id', folder_id);

  if (deleteError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'folder_delete',
        user_id,
        folder_id,
        error: deleteError.message,
        message: 'Failed to delete folder'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to delete folder',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_delete',
      user_id,
      folder_id,
      cascade: cascadeMode,
      message: 'Folder deleted successfully'
    })
  );

  return {
    ok: true,
  };
}
