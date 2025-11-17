// Purpose: Return flat list of folders for a class
// Migrated from: /api/folders/flat
// Features: Optional note counts, sorted by sort_index, RLS enforcement

import type { GatewayContext } from '../../_types.js';
import { createClient } from '@supabase/supabase-js';

interface Folder {
  id: string;
  user_id: string;
  class_id: string;
  parent_id: string | null;
  name: string;
  sort_index: number;
  created_at: string;
  updated_at: string;
  note_count?: number;
}

export async function folder_flat(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, req } = context;

  // Validate query params
  const { class_id, include_counts } = req.query;

  if (!class_id || typeof class_id !== 'string') {
    throw {
      code: 'MISSING_CLASS_ID',
      message: 'class_id query parameter is required',
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

  // Fetch folders for this class
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('id, user_id, class_id, parent_id, name, sort_index, created_at, updated_at')
    .eq('class_id', class_id)
    .order('sort_index', { ascending: true });

  if (foldersError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'folder_flat',
        class_id,
        error: foldersError.message,
        message: 'Failed to fetch folders'
      })
    );
    throw {
      code: 'DATABASE_ERROR',
      message: 'Failed to fetch folders',
      status: 500
    };
  }

  // If include_counts=true, fetch note counts per folder
  let foldersWithCounts: Folder[] = folders || [];

  if (include_counts === 'true' && folders && folders.length > 0) {
    const folderIds = folders.map((f) => f.id);

    // Count notes per folder
    const { data: noteCounts, error: countsError } = await supabase
      .from('note_folders')
      .select('folder_id')
      .in('folder_id', folderIds);

    if (!countsError && noteCounts) {
      // Build count map
      const countMap = new Map<string, number>();
      for (const nc of noteCounts) {
        const currentCount = countMap.get(nc.folder_id) || 0;
        countMap.set(nc.folder_id, currentCount + 1);
      }

      // Add counts to folders
      foldersWithCounts = folders.map((folder) => ({
        ...folder,
        note_count: countMap.get(folder.id) || 0,
      }));
    }
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_flat',
      class_id,
      folder_count: foldersWithCounts.length,
      message: 'Flat folder list retrieved'
    })
  );

  return {
    folders: foldersWithCounts,
  };
}
