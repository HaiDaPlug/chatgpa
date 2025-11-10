/**
 * GET /api/folders/path
 * Returns breadcrumb path from root to target folder
 * Use case: Avoid N+1 queries for breadcrumbs
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

interface BreadcrumbSegment {
  id: string;
  name: string;
  type: "class" | "folder";
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

    // Get folder_id from query
    const { folder_id } = req.query;

    if (!folder_id || typeof folder_id !== "string") {
      return res.status(400).json({
        code: "MISSING_FOLDER_ID",
        message: "folder_id query parameter is required",
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

    // Fetch the target folder
    const { data: targetFolder, error: folderError } = await supabase
      .from("folders")
      .select("id, name, class_id, parent_id")
      .eq("id", folder_id)
      .single();

    if (folderError || !targetFolder) {
      return res.status(404).json({
        code: "FOLDER_NOT_FOUND",
        message: "Folder not found or you don't have access",
      });
    }

    // Fetch the class name
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name")
      .eq("id", targetFolder.class_id)
      .single();

    if (classError || !classData) {
      return res.status(404).json({
        code: "CLASS_NOT_FOUND",
        message: "Class not found",
      });
    }

    // Build path by walking up parent_id chain
    const path: BreadcrumbSegment[] = [];

    // Start with class
    path.push({
      id: classData.id,
      name: classData.name,
      type: "class",
    });

    // Walk up folder hierarchy
    const folderPath: Array<{ id: string; name: string }> = [];
    let currentFolderId: string | null = folder_id;
    const visited = new Set<string>(); // Prevent infinite loops

    while (currentFolderId) {
      // Check for circular reference
      if (visited.has(currentFolderId)) {
        console.error("CIRCULAR_FOLDER_REFERENCE", { folder_id, currentFolderId });
        break;
      }
      visited.add(currentFolderId);

      const { data: folder, error } = await supabase
        .from("folders")
        .select("id, name, parent_id")
        .eq("id", currentFolderId)
        .single() as { data: { id: string; name: string; parent_id: string | null } | null; error: any };

      if (error || !folder) break;

      folderPath.unshift({ id: folder.id, name: folder.name });
      currentFolderId = folder.parent_id;

      // Safety limit
      if (folderPath.length > 20) {
        console.error("FOLDER_PATH_TOO_DEEP", { folder_id });
        break;
      }
    }

    // Add folders to path
    for (const folder of folderPath) {
      path.push({
        id: folder.id,
        name: folder.name,
        type: "folder",
      });
    }

    return res.status(200).json({
      path,
    });
  } catch (error: any) {
    console.error("FOLDERS_PATH_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
