/**
 * GET /api/folders/flat
 * Returns flat list of folders for a class (with parent_id field)
 * Use case: Dropdowns, breadcrumbs, caching
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
    const { class_id, include_counts } = req.query;

    if (!class_id || typeof class_id !== "string") {
      return res.status(400).json({
        code: "MISSING_CLASS_ID",
        message: "class_id query parameter is required",
      });
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

    // Verify user owns the class (RLS will enforce, but good to check explicitly)
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

    // Fetch folders for this class
    let query = supabase
      .from("folders")
      .select("id, user_id, class_id, parent_id, name, sort_index, created_at, updated_at")
      .eq("class_id", class_id)
      .order("sort_index", { ascending: true });

    const { data: folders, error: foldersError } = await query;

    if (foldersError) {
      console.error("FOLDERS_FETCH_ERROR", { class_id, error: foldersError });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to fetch folders",
      });
    }

    // If include_counts=true, fetch note counts per folder
    let foldersWithCounts: Folder[] = folders || [];

    if (include_counts === "true" && folders && folders.length > 0) {
      const folderIds = folders.map((f) => f.id);

      // Count notes per folder
      const { data: noteCounts, error: countsError } = await supabase
        .from("note_folders")
        .select("folder_id")
        .in("folder_id", folderIds);

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

    return res.status(200).json({
      folders: foldersWithCounts,
    });
  } catch (error: any) {
    console.error("FOLDERS_FLAT_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
