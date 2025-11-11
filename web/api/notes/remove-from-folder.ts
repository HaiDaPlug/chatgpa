/**
 * DELETE /api/notes/remove-from-folder
 * Removes a note from a folder (note becomes uncategorized)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow DELETE
    if (req.method !== "DELETE") {
      return res.status(405).json({
        code: "METHOD_NOT_ALLOWED",
        message: "Only DELETE allowed",
      });
    }

    // Get note_id and folder_id from query
    const { note_id, folder_id } = req.query;

    if (!note_id || typeof note_id !== "string") {
      return res.status(400).json({
        code: "MISSING_NOTE_ID",
        message: "note_id query parameter is required",
      });
    }

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

    // Verify mapping exists and user owns it (RLS will also enforce)
    const { data: mapping, error: fetchError } = await supabase
      .from("note_folders")
      .select("note_id, folder_id")
      .eq("note_id", note_id)
      .eq("folder_id", folder_id)
      .single();

    if (fetchError || !mapping) {
      return res.status(404).json({
        code: "MAPPING_NOT_FOUND",
        message: "Note-folder mapping not found or you don't have access",
      });
    }

    // Delete the mapping
    const { error: deleteError } = await supabase
      .from("note_folders")
      .delete()
      .eq("note_id", note_id)
      .eq("folder_id", folder_id);

    if (deleteError) {
      console.error("NOTE_FOLDER_REMOVE_ERROR", {
        user_id: user.id,
        note_id,
        folder_id,
        error: deleteError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to remove note from folder",
      });
    }

    return res.status(200).json({
      ok: true,
    });
  } catch (error: any) {
    console.error("NOTE_FOLDER_REMOVE_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
