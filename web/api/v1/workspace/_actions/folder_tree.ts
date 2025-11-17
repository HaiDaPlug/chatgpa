// Purpose: Return nested folder tree for a class
// Migrated from: /api/folders/tree
// Features: Tree building, note counts, depth limiting, RLS enforcement

import type { GatewayContext } from '../../_types.js';
import { createClient } from '@supabase/supabase-js';
import { FolderTreeQuery } from '../_schemas.js';

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
  children?: Folder[];
}

/**
 * Build nested tree structure from flat folder list
 */
function buildTree(folders: Folder[], maxDepth?: number): Folder[] {
  const folderMap = new Map<string, Folder>();
  const rootFolders: Folder[] = [];

  // First pass: Create map and initialize children arrays
  for (const folder of folders) {
    folderMap.set(folder.id, { ...folder, children: [] });
  }

  // Second pass: Build tree structure
  for (const folder of folders) {
    const folderNode = folderMap.get(folder.id)!;

    if (folder.parent_id === null) {
      // Root-level folder
      rootFolders.push(folderNode);
    } else {
      // Child folder - add to parent's children
      const parent = folderMap.get(folder.parent_id);
      if (parent) {
        parent.children!.push(folderNode);
      } else {
        // Parent not found (orphaned folder) - treat as root
        rootFolders.push(folderNode);
      }
    }
  }

  // Sort children by sort_index at each level
  const sortChildren = (folders: Folder[]) => {
    folders.sort((a, b) => a.sort_index - b.sort_index);
    for (const folder of folders) {
      if (folder.children && folder.children.length > 0) {
        sortChildren(folder.children);
      }
    }
  };

  sortChildren(rootFolders);

  // Apply depth limit if specified
  if (maxDepth !== undefined) {
    const limitDepth = (folders: Folder[], currentDepth: number) => {
      if (currentDepth >= maxDepth) {
        for (const folder of folders) {
          delete folder.children;
        }
        return;
      }

      for (const folder of folders) {
        if (folder.children && folder.children.length > 0) {
          limitDepth(folder.children, currentDepth + 1);
        }
      }
    };

    limitDepth(rootFolders, 0);
  }

  return rootFolders;
}

export async function folder_tree(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const { request_id, token, req } = context;

  // Validate query params
  const { class_id, depth } = req.query;

  if (!class_id || typeof class_id !== 'string') {
    throw {
      code: 'MISSING_CLASS_ID',
      message: 'class_id query parameter is required',
      status: 400
    };
  }

  // Parse depth parameter (optional)
  let maxDepth: number | undefined;
  if (depth && typeof depth === 'string') {
    const parsedDepth = parseInt(depth, 10);
    if (!isNaN(parsedDepth) && parsedDepth > 0) {
      maxDepth = parsedDepth;
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

  // Fetch all folders for this class
  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('id, user_id, class_id, parent_id, name, sort_index, created_at, updated_at')
    .eq('class_id', class_id);

  if (foldersError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        request_id,
        action: 'folder_tree',
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

  if (!folders || folders.length === 0) {
    return {
      tree: [],
    };
  }

  // Fetch note counts for all folders
  const folderIds = folders.map((f) => f.id);
  const { data: noteCounts, error: countsError } = await supabase
    .from('note_folders')
    .select('folder_id')
    .in('folder_id', folderIds);

  // Build count map
  const countMap = new Map<string, number>();
  if (!countsError && noteCounts) {
    for (const nc of noteCounts) {
      const currentCount = countMap.get(nc.folder_id) || 0;
      countMap.set(nc.folder_id, currentCount + 1);
    }
  }

  // Add counts to folders
  const foldersWithCounts: Folder[] = folders.map((folder) => ({
    ...folder,
    note_count: countMap.get(folder.id) || 0,
  }));

  // Build tree structure
  const tree = buildTree(foldersWithCounts, maxDepth);

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      request_id,
      action: 'folder_tree',
      class_id,
      folder_count: folders.length,
      message: 'Folder tree retrieved'
    })
  );

  return {
    tree,
  };
}
