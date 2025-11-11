/**
 * POST /api/folders/create
 * Creates a new folder in a class
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const config = { runtime: "nodejs" };

const CreateFolderSchema = z.object({
  class_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(64),
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
    const parseResult = CreateFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: "INVALID_INPUT",
        message: parseResult.error.issues[0]?.message || "Invalid input",
      });
    }

    const { class_id, parent_id, name } = parseResult.data;

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

    // If parent_id provided, verify it exists and belongs to same class
    if (parent_id) {
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

      if (parentFolder.class_id !== class_id) {
        return res.status(400).json({
          code: "PARENT_CLASS_MISMATCH",
          message: "Parent folder must belong to the same class",
        });
      }
    }

    // Calculate sort_index (append to end with gap)
    const { data: siblings, error: siblingsError } = await supabase
      .from("folders")
      .select("sort_index")
      .eq("class_id", class_id)
      .eq("parent_id", parent_id || null)
      .order("sort_index", { ascending: false })
      .limit(1);

    let sort_index = 100; // Default for first folder
    if (!siblingsError && siblings && siblings.length > 0) {
      sort_index = siblings[0].sort_index + 100;
    }

    // Create folder
    const { data: folder, error: createError } = await supabase
      .from("folders")
      .insert({
        user_id: user.id,
        class_id,
        parent_id: parent_id || null,
        name,
        sort_index,
      })
      .select()
      .single();

    if (createError) {
      console.error("FOLDER_CREATE_ERROR", {
        user_id: user.id,
        class_id,
        error: createError,
      });
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: "Failed to create folder",
      });
    }

    return res.status(201).json({
      folder,
    });
  } catch (error: any) {
    console.error("FOLDER_CREATE_SERVER_ERROR", { error: error?.message || "Unknown error" });
    return res.status(500).json({
      code: "SERVER_ERROR",
      message: "Internal server error",
    });
  }
}
