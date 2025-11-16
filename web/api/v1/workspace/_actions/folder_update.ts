// Purpose: Update folder name, parent_id, or sort_index
// Migrated from: /api/folders/update
// Features: Circular reference prevention, parent validation, RLS enforcement

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';
import { FolderUpdateInput } from '../_schemas';

export async function folder_update(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, user_id } = context;

  // Validate input
  const parseResult = FolderUpdateInput.safeParse(data);
  if (!parseResult.success) {
    throw {
      code: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input',
      status: 400
    };
  }

  const { folder_id, name, parent_id, sort_index } = parseResult.data;

  // At least one field must be provided
  if (name === undefined && parent_id === undefined && sort_index === undefined) {
    throw {
      code: 'NO_UPDATES',
      message: 'At least one of name, parent_id, or sort_index must be provided',
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

  // Fetch current folder (also verifies ownership via RLS)
  const { data: currentFolder, error: fetchError } = await supabase
    .from('folders')
    .select('id, class_id, parent_id, name')
    .eq('id', folder_id)
    .single();

  if (fetchError || !currentFolder) {
    throw {
      code: 'FOLDER_NOT_FOUND',
      message: 'Folder not found or you don\'t have access',
      status: 404
    };
  }

  // If moving to new parent, verify parent exists and belongs to same class
  if (parent_id !== undefined) {
    // Cannot be own parent (handled by DB trigger, but check here too)
    if (parent_id === folder_id) {
      throw {
        code: 'CANNOT_BE_OWN_PARENT',
        message: 'Folder cannot be its own parent',
        status: 400
      };
    }

    // If parent_id is not null, verify it exists
    if (parent_id !== null) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .select('id, class_id')
        .eq('id', parent_id)
        .single();

      if (parentError || !parentFolder) {
        throw {
          code: 'PARENT_NOT_FOUND',
          message: 'Parent folder not found',
          status: 404
        };
      }

      if (parentFolder.class_id !== currentFolder.class_id) {
        throw {
          code: 'PARENT_CLASS_MISMATCH',
          message: 'Parent folder must belong to the same class',
          status: 400
        };
      }
    }
  }

  // Build update object
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (parent_id !== undefined) updates.parent_id = parent_id;
  if (sort_index !== undefined) updates.sort_index = sort_index;

  // Update folder (DB trigger will check for circular refs)
  const { data: updatedFolder, error: updateError } = await supabase
    .from('folders')
    .update(updates)
    .eq('id', folder_id)
    .select()
    .single();

  if (updateError) {
    // Check if it's a circular reference error
    if (updateError.message?.includes('Circular folder reference')) {
      throw {
        code: 'CIRCULAR_REFERENCE',
        message: 'Cannot move folder: would create a circular reference',
        status: 400
      };
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'folder_update',
        user_id,
        folder_id,
        error: updateError.message,
        message: 'Failed to update folder'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to update folder',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_update',
      user_id,
      folder_id,
      message: 'Folder updated successfully'
    })
  );

  return {
    folder: updatedFolder,
  };
}
