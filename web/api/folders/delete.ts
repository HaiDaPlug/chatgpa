/**
 * DELETE /api/folders/delete
 * Deletes a folder (requires empty unless cascade parameter provided)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

type CascadeMode = "move-to-parent" | "move-to-uncategorized";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow DELETE
    if (req.method !== "DELETE") {
      return res.status(405).json({
        code: "METHOD_NOT_ALLOWED",
        message: "Only DELETE allowed",
      });
    }

    // Get folder_id and cascade from query
    const { folder_id, cascade } = req.query;

    if (!folder_id || typeof folder_id !== "string") {
      return res.status(400).json({
        code: "MISSING_FOLDER_ID",
        message: "folder_id query parameter is required",
      });
    }

    // Validate cascade parameter if provided
    let cascadeMode: CascadeMode | null = null;
    if (cascade) {
      if (cascade === "move-to-parent" || cascade === "move-to-uncategorized") {
        cascadeMode = cascade;
      } else {
        return res.status(400).json({
          code: "INVALID_CASCADE",
          message: "cascade must be 'move-to-parent' or 'move-to-uncategorized'",
        });
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

    // Fetch folder (verifies ownership via RLS)
    const { data: folder, error: fetchError } = await supabase
      .from("folders")
      .select("id, parent_id, class_id")
      .eq("id", folder_id)
      .single();

    if (fetchError || !folder) {
      return res.status(404).json({
        code: "FOLDER_NOT_FOUND",
        message: "Folder not found or you don't have access",
      });
    }

    // Check if folder has children
    const { data: children, error: childrenError } = await supabase
      .from("folders")
      .select("id")
      .eq("parent_id", folder_id)
      .limit(1);

    const hasChildren = !childrenError && children && children.length > 0;

    // Check if folder has notes
    const { data: notes, error: notesError } = await supabase
      .from("note_folders")
      .select("note_id")
      .eq("folder_id", folder_id)
      .limit(1);

    const hasNotes = !notesError && notes && notes.length > 0;

    // If folder is not empty and no cascade mode, reject
    if ((hasChildren || hasNotes) && !cascadeMode) {
      return res.status(409).json({
        code: "FOLDER_NOT_EMPTY",
        message: "Folder is not empty. Use cascade parameter to move contents before deleting.",
      });
    }

    // If cascade mode, handle contents
    if (cascadeMode) {
      if (cascadeMode === "move-to-parent") {
        // Move child folders to parent (or null if this is root-level)
        if (hasChildren) {
          const { error: moveChildrenError } = await supabase
            .from("folders")
            .update({ parent_id: folder.parent_id })
            .eq("parent_id", folder_id);

          if (moveChildrenError) {
            console.error("FOLDER_MOVE_CHILDREN_ERROR", {
              folder_id,
              error: moveChildrenError,
            });
            return res.status(500).json({
              code: "DATABASE_ERROR",
              message: "Failed to move child folders",
            });
          }
        }

        // Move notes to parent folder (or remove mapping if no parent)
        if (hasNotes) {
          if (folder.parent_id) {
            // Update note_folders to point to parent
            const { error: moveNotesError } = await supabase
              .from("note_folders")
              .update({ folder_id: folder.parent_id })
              .eq("folder_id", folder_id);

            if (moveNotesError) {
              console.error("FOLDER_MOVE_NOTES_ERROR", {
                folder_id,
                error: moveNotesError,
              });
              return res.status(500).json({
                code: "DATABASE_ERROR",
                message: "Failed to move notes",
              });
            }
          } else {
            // No parent - delete mappings (notes become uncategorized)
            const { error: deleteNotesError } = await supabase
              .from("note_folders")
              .delete()
              .eq("folder_id", folder_id);

            if (deleteNotesError) {
              console.error("FOLDER_DELETE_NOTES_ERROR", {
                folder_id,
                error: deleteNotesError,
              });
              return res.status(500).json({
                code: "DATABASE_ERROR",
                message: "Failed to remove note mappings",
              });
            }
          }
        }
      } else if (cascadeMode === "move-to-uncategorized") {
        // Move child folders to root (parent_id = null)
        if (hasChildren) {
          const { error: moveChildrenError } = await supabase
            .from("folders")
            .update({ parent_id: null })
            .eq("parent_id", folder_id);

          if (moveChildrenError) {
            console.error("FOLDER_MOVE_CHILDREN_ROOT_ERROR", {
              folder_id,
              error: moveChildrenError,
            });
            return res.status(500).json({
              code: "DATABASE_ERROR",
              message: "Failed to move child folders to root",
            });
          }
        }

        // Delete note mappings (notes become uncategorized)
        if (hasNotes) {
          const { error: deleteNotesError } = await supabase
            .from("note_folders")
            .delete()
            .eq("folder_id", folder_id);

          if (deleteNotesError) {
            console.error("FOLDER_DELETE_NOTES_UNCATEGORIZED_ERROR", {
              folder_id,
              error: deleteNotesError,
            });
            return res.status(500).json({
              code: "DATABASE_ERROR",
              message: "Failed to remove note mappings",
            });
          }
        }
      }
    }

    // Delete the folder (CASCADE will handle note_folders if any remain)
    const { error: deleteError } = await supabase
      .from("folders")
      .delete()
      .eq("id", folder_id);

    if (deleteError) {
      console.error("FOLDER_DELETE_ERROR", {
        user_id: user.id,
        folder_id,
        error: deleteError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to delete folder",
      });
    }

    return res.status(200).json({
      ok: true,
    });
  } catch (error: any) {
    console.error("FOLDER_DELETE_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
