/**
 * PATCH /api/folders/update
 * Updates folder name, parent_id, or sort_index
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const config = { runtime: "nodejs" };

const UpdateFolderSchema = z.object({
  folder_id: z.string().uuid(),
  name: z.string().min(1).max(64).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_index: z.number().int().optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow PATCH
    if (req.method !== "PATCH") {
      return res.status(405).json({
        code: "METHOD_NOT_ALLOWED",
        message: "Only PATCH allowed",
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
    const parseResult = UpdateFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: parseResult.error.issues[0]?.message || "Invalid input",
      });
    }

    const { folder_id, name, parent_id, sort_index } = parseResult.data;

    // At least one field must be provided
    if (name === undefined && parent_id === undefined && sort_index === undefined) {
      return res.status(400).json({
        code: "NO_UPDATES",
        message: "At least one of name, parent_id, or sort_index must be provided",
      });
    }

    // Fetch current folder (also verifies ownership via RLS)
    const { data: currentFolder, error: fetchError } = await supabase
      .from("folders")
      .select("id, class_id, parent_id, name")
      .eq("id", folder_id)
      .single();

    if (fetchError || !currentFolder) {
      return res.status(404).json({
        code: "FOLDER_NOT_FOUND",
        message: "Folder not found or you don't have access",
      });
    }

    // If moving to new parent, verify parent exists and belongs to same class
    if (parent_id !== undefined) {
      // Cannot be own parent (handled by DB trigger, but check here too)
      if (parent_id === folder_id) {
        return res.status(400).json({
          code: "CANNOT_BE_OWN_PARENT",
          message: "Folder cannot be its own parent",
        });
      }

      // If parent_id is not null, verify it exists
      if (parent_id !== null) {
        const { data: parentFolder, error: parentError } = await supabase
          .from("folders")
          .select("id, class_id")
          .eq("id", parent_id)
          .single();

        if (parentError || !parentFolder) {
          return res.status(404).json({
            code: "PARENT_NOT_FOUND",
            message: "Parent folder not found",
          });
        }

        if (parentFolder.class_id !== currentFolder.class_id) {
          return res.status(400).json({
            code: "PARENT_CLASS_MISMATCH",
            message: "Parent folder must belong to the same class",
          });
        }
      }
    }

    // Build update object
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (parent_id !== undefined) updates.parent_id = parent_id;
    if (sort_index !== undefined) updates.sort_index = sort_index;

    // Update folder (DB trigger will check for circular refs)
    const { data: updatedFolder, error: updateError } = await supabase
      .from("folders")
      .update(updates)
      .eq("id", folder_id)
      .select()
      .single();

    if (updateError) {
      // Check if it's a circular reference error
      if (updateError.message?.includes("Circular folder reference")) {
        return res.status(400).json({
          code: "CIRCULAR_REFERENCE",
          message: "Cannot move folder: would create a circular reference",
        });
      }

      console.error("FOLDER_UPDATE_ERROR", {
        user_id: user.id,
        folder_id,
        error: updateError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to update folder",
      });
    }

    return res.status(200).json({
      folder: updatedFolder,
    });
  } catch (error: any) {
    // Check if it's a circular reference error from trigger
    if (error.message?.includes("Circular folder reference")) {
      return res.status(400).json({
        code: "CIRCULAR_REFERENCE",
        message: "Cannot move folder: would create a circular reference",
      });
    }

    console.error("FOLDER_UPDATE_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
