/**
 * GET /api/classes/notes-uncategorized
 * Returns notes without folder mapping (uncategorized notes)
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

    // Get class_id, cursor, and limit from query
    const { class_id, cursor, limit: limitParam } = req.query;

    if (!class_id || typeof class_id !== "string") {
      return res.status(400).json({
        code: "MISSING_CLASS_ID",
        message: "class_id query parameter is required",
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

    // Verify class exists and user has access
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

    // Fetch all note_folders mappings for this class to exclude
    const { data: mappedNotes, error: mappingsError } = await supabase
      .from("note_folders")
      .select("note_id, folders!inner(class_id)")
      .eq("folders.class_id", class_id);

    if (mappingsError) {
      console.error("UNCATEGORIZED_MAPPINGS_FETCH_ERROR", {
        class_id,
        error: mappingsError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to fetch note mappings",
      });
    }

    // Build list of mapped note IDs
    const mappedNoteIds = new Set(
      (mappedNotes || []).map((m: any) => m.note_id)
    );

    // Fetch all notes for this class
    let query = supabase
      .from("notes")
      .select("id, user_id, class_id, title, source_type, path, content, created_at")
      .eq("class_id", class_id)
      .order("created_at", { ascending: false })
      .limit(limit * 2); // Fetch extra to account for filtering

    // Apply cursor if provided
    if (cursor && typeof cursor === "string") {
      query = query.lt("created_at", cursor);
    }

    const { data: allNotes, error: notesError } = await query;

    if (notesError) {
      console.error("UNCATEGORIZED_NOTES_FETCH_ERROR", {
        class_id,
        error: notesError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to fetch notes",
      });
    }

    // Filter out mapped notes
    const uncategorizedNotes = (allNotes || []).filter(
      (note) => !mappedNoteIds.has(note.id)
    );

    // Apply limit
    const hasMore = uncategorizedNotes.length > limit;
    const notesToReturn = hasMore
      ? uncategorizedNotes.slice(0, limit)
      : uncategorizedNotes;

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
    console.error("UNCATEGORIZED_NOTES_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
