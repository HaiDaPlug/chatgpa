// Purpose: Return breadcrumb path from root to target folder
// Migrated from: /api/folders/path
// Features: Circular reference detection, depth limit, RLS enforcement

import type { GatewayContext } from '../../_types';
import { createClient } from '@supabase/supabase-js';

interface BreadcrumbSegment {
  id: string;
  name: string;
  type: 'class' | 'folder';
}

export async function folder_path(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, req } = context;

  // Get folder_id from query
  const { folder_id } = req.query;

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

  // Fetch the target folder
  const { data: targetFolder, error: folderError } = await supabase
    .from('folders')
    .select('id, name, class_id, parent_id')
    .eq('id', folder_id)
    .single();

  if (folderError || !targetFolder) {
    throw {
      code: 'FOLDER_NOT_FOUND',
      message: 'Folder not found or you don\'t have access',
      status: 404
    };
  }

  // Fetch the class name
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('id', targetFolder.class_id)
    .single();

  if (classError || !classData) {
    throw {
      code: 'CLASS_NOT_FOUND',
      message: 'Class not found',
      status: 404
    };
  }

  // Build path by walking up parent_id chain
  const path: BreadcrumbSegment[] = [];

  // Start with class
  path.push({
    id: classData.id,
    name: classData.name,
    type: 'class',
  });

  // Walk up folder hierarchy
  const folderPath: Array<{ id: string; name: string }> = [];
  let currentFolderId: string | null = folder_id;
  const visited = new Set<string>(); // Prevent infinite loops

  while (currentFolderId) {
    // Check for circular reference
    if (visited.has(currentFolderId)) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          action: 'folder_path',
          folder_id,
          currentFolderId,
          message: 'Circular folder reference detected'
        })
      );
      break;
    }
    visited.add(currentFolderId);

    const { data: folder, error } = await supabase
      .from('folders')
      .select('id, name, parent_id')
      .eq('id', currentFolderId)
      .single() as { data: { id: string; name: string; parent_id: string | null } | null; error: any };

    if (error || !folder) break;

    folderPath.unshift({ id: folder.id, name: folder.name });
    currentFolderId = folder.parent_id;

    // Safety limit
    if (folderPath.length > 20) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          request_id,
          action: 'folder_path',
          folder_id,
          message: 'Folder path too deep (>20 levels)'
        })
      );
      break;
    }
  }

  // Add folders to path
  for (const folder of folderPath) {
    path.push({
      id: folder.id,
      name: folder.name,
      type: 'folder',
    });
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_path',
      folder_id,
      path_length: path.length,
      message: 'Folder path retrieved'
    })
  );

  return {
    path,
  };
}
