/**
 * POST /api/notes/add-to-folder
 * Adds a note to a folder (removes previous mapping if exists)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const config = { runtime: "nodejs" };

const AddToFolderSchema = z.object({
  note_id: z.string().uuid(),
  folder_id: z.string().uuid(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST allowed",
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

    // Get user ID
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid authentication token",
      });
    }

    // Parse and validate request body
    const parseResult = AddToFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: parseResult.error.issues[0]?.message || "Invalid input",
      });
    }

    const { note_id, folder_id } = parseResult.data;

    // Fetch note (verifies ownership via RLS)
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .select("id, class_id")
      .eq("id", note_id)
      .single();

    if (noteError || !note) {
      return res.status(404).json({
        code: "NOTE_NOT_FOUND",
        message: "Note not found or you don't have access",
      });
    }

    // Fetch folder (verifies ownership via RLS)
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id, class_id")
      .eq("id", folder_id)
      .single();

    if (folderError || !folder) {
      return res.status(404).json({
        code: "FOLDER_NOT_FOUND",
        message: "Folder not found or you don't have access",
      });
    }

    // Verify note and folder belong to same class
    if (note.class_id !== folder.class_id) {
      return res.status(400).json({
        code: "CLASS_MISMATCH",
        message: "Note and folder must belong to the same class",
      });
    }

    // Check if note already has a mapping in this class (app-level guard)
    const { data: existingMappings, error: mappingsError } = await supabase
      .from("note_folders")
      .select("folder_id, folders!inner(class_id)")
      .eq("note_id", note_id);

    if (!mappingsError && existingMappings) {
      // Filter to same class
      const sameClassMappings = existingMappings.filter(
        (m: any) => m.folders.class_id === note.class_id
      );

      // If already mapped to a folder in this class, remove old mapping
      if (sameClassMappings.length > 0) {
        const oldFolderIds = sameClassMappings.map((m: any) => m.folder_id);

        const { error: deleteError } = await supabase
          .from("note_folders")
          .delete()
          .eq("note_id", note_id)
          .in("folder_id", oldFolderIds);

        if (deleteError) {
          console.error("NOTE_FOLDER_DELETE_OLD_ERROR", {
            note_id,
            oldFolderIds,
            error: deleteError,
          });
          // Continue anyway - insert might work
        }
      }
    }

    // Insert new mapping (UPSERT to handle race conditions)
    const { data: mapping, error: insertError } = await supabase
      .from("note_folders")
      .upsert(
        {
          note_id,
          folder_id,
          user_id: user.id,
        },
        {
          onConflict: "note_id, folder_id",
        }
      )
      .select()
      .single();

    if (insertError) {
      console.error("NOTE_FOLDER_INSERT_ERROR", {
        user_id: user.id,
        note_id,
        folder_id,
        error: insertError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to add note to folder",
      });
    }

    return res.status(200).json({
      ok: true,
    });
  } catch (error: any) {
    console.error("NOTE_FOLDER_ADD_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
