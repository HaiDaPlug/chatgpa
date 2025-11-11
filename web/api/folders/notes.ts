/**
 * GET /api/folders/notes
 * Returns paginated notes in a folder
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET
    if (req.method !== "GET") {
      return res.status(405).json({
        code: "METHOD_NOT_ALLOWED",
        message: "Only GET allowed",
      });
    }

    // Get folder_id, cursor, and limit from query
    const { folder_id, cursor, limit: limitParam } = req.query;

    if (!folder_id || typeof folder_id !== "string") {
      return res.status(400).json({
        code: "MISSING_FOLDER_ID",
        message: "folder_id query parameter is required",
      });
    }

    // Parse limit (default 20, max 100)
    let limit = 20;
    if (limitParam && typeof limitParam === "string") {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100) {
        limit = parsedLimit;
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

    // Create Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    // Verify folder exists and user has access
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folder_id)
      .single();

    if (folderError || !folder) {
      return res.status(404).json({
        code: "FOLDER_NOT_FOUND",
        message: "Folder not found or you don't have access",
      });
    }

    // Fetch notes in this folder
    let query = supabase
      .from("notes")
      .select(
        `
        id,
        user_id,
        class_id,
        title,
        source_type,
        path,
        content,
        created_at,
        note_folders!inner(folder_id)
      `
      )
      .eq("note_folders.folder_id", folder_id)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there's more

    // Apply cursor if provided (created_at for pagination)
    if (cursor && typeof cursor === "string") {
      query = query.lt("created_at", cursor);
    }

    const { data: notes, error: notesError } = await query;

    if (notesError) {
      console.error("FOLDER_NOTES_FETCH_ERROR", {
        folder_id,
        error: notesError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to fetch notes",
      });
    }

    // Check if there are more results
    const hasMore = notes && notes.length > limit;
    const notesToReturn = hasMore ? notes.slice(0, limit) : notes || [];

    // Next cursor is the created_at of the last note
    const nextCursor = hasMore && notesToReturn.length > 0
      ? notesToReturn[notesToReturn.length - 1].created_at
      : null;

    return res.status(200).json({
      notes: notesToReturn,
      cursor: nextCursor,
      has_more: hasMore,
    });
  } catch (error: any) {
    console.error("FOLDER_NOTES_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
