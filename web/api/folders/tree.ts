/**
 * GET /api/folders/tree
 * Returns nested folder tree for a class
 * Use case: Left pane tree rendering
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET
    if (req.method !== "GET") {
      return res.status(405).json({
        code: "METHOD_NOT_ALLOWED",
        message: "Only GET allowed",
      });
    }

    // Get class_id from query
    const { class_id, depth } = req.query;

    if (!class_id || typeof class_id !== "string") {
      return res.status(400).json({
        code: "MISSING_CLASS_ID",
        message: "class_id query parameter is required",
      });
    }

    // Parse depth parameter (optional)
    let maxDepth: number | undefined;
    if (depth && typeof depth === "string") {
      const parsedDepth = parseInt(depth, 10);
      if (!isNaN(parsedDepth) && parsedDepth > 0) {
        maxDepth = parsedDepth;
      }
    }

    // Get auth token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Authorization header required",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Create Supabase client (anon key with user token)
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
      .from("classes")
      .select("id")
      .eq("id", class_id)
      .single();

    if (classError || !classData) {
      return res.status(404).json({
        code: "CLASS_NOT_FOUND",
        message: "Class not found or you don't have access",
      });
    }

    // Fetch all folders for this class
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, user_id, class_id, parent_id, name, sort_index, created_at, updated_at")
      .eq("class_id", class_id);

    if (foldersError) {
      console.error("FOLDERS_FETCH_ERROR", { class_id, error: foldersError });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to fetch folders",
      });
    }

    if (!folders || folders.length === 0) {
      return res.status(200).json({
        tree: [],
      });
    }

    // Fetch note counts for all folders
    const folderIds = folders.map((f) => f.id);
    const { data: noteCounts, error: countsError } = await supabase
      .from("note_folders")
      .select("folder_id")
      .in("folder_id", folderIds);

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

    return res.status(200).json({
      tree,
    });
  } catch (error: any) {
    console.error("FOLDERS_TREE_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
