// Purpose: Create new folder in a class
// Migrated from: /api/folders/create
// Features: Parent validation, sort_index calculation, RLS enforcement

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';
import { FolderCreateInput } from '../_schemas';

export async function folder_create(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, user_id } = context;

  // Validate input
  const parseResult = FolderCreateInput.safeParse(data);
  if (!parseResult.success) {
    throw {
      code: 'INVALID_INPUT',
      message: parseResult.error.issues[0]?.message || 'Invalid input',
      status: 400
    };
  }

  const { class_id, parent_id, name } = parseResult.data;

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

  // Verify user owns the class
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

  // If parent_id provided, verify it exists and belongs to same class
  if (parent_id) {
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

    if (parentFolder.class_id !== class_id) {
      throw {
        code: 'PARENT_CLASS_MISMATCH',
        message: 'Parent folder must belong to the same class',
        status: 400
      };
    }
  }

  // Calculate sort_index (append to end with gap)
  const { data: siblings, error: siblingsError } = await supabase
    .from('folders')
    .select('sort_index')
    .eq('class_id', class_id)
    .eq('parent_id', parent_id || null)
    .order('sort_index', { ascending: false })
    .limit(1);

  let sort_index = 100; // Default for first folder
  if (!siblingsError && siblings && siblings.length > 0) {
    sort_index = siblings[0].sort_index + 100;
  }

  // Create folder
  const { data: folder, error: createError } = await supabase
    .from('folders')
    .insert({
      user_id,
      class_id,
      parent_id: parent_id || null,
      name,
      sort_index,
    })
    .select()
    .single();

  if (createError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'folder_create',
        user_id,
        class_id,
        error: createError.message,
        message: 'Failed to create folder'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to create folder',
      status: 500
    };
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_create',
      user_id,
      folder_id: folder.id,
      message: 'Folder created successfully'
    })
  );

  return {
    folder,
  };
}
