// Purpose: Zod schemas for workspace gateway validation
// Covers: Folders (CRUD, tree, path) + Notes (folder management)

import { z } from 'zod';

// ===== Folder Schemas =====

export const FolderCreateInput = z.object({
  class_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(64),
});

export const FolderUpdateInput = z.object({
  folder_id: z.string().uuid(),
  name: z.string().min(1).max(64).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_index: z.number().int().optional(),
});

export const FolderTreeQuery = z.object({
  class_id: z.string().uuid(),
  depth: z.string().optional(),
});

export const FolderFlatQuery = z.object({
  class_id: z.string().uuid(),
  include_counts: z.enum(['true', 'false']).optional(),
});

export const FolderDeleteQuery = z.object({
  folder_id: z.string().uuid(),
  cascade: z.enum(['move-to-parent', 'move-to-uncategorized']).optional(),
});

export const FolderNotesQuery = z.object({
  folder_id: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.string().optional(),
});

export const FolderPathQuery = z.object({
  folder_id: z.string().uuid(),
});

// ===== Note Folder Schemas =====

export const NoteAddToFolderInput = z.object({
  note_id: z.string().uuid(),
  folder_id: z.string().uuid(),
});

export const NoteRemoveFromFolderQuery = z.object({
  note_id: z.string().uuid(),
  folder_id: z.string().uuid(),
});

// ===== Output Schemas (for documentation) =====

export const FolderOutput = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  class_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  name: z.string(),
  sort_index: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  note_count: z.number().optional(),
  children: z.array(z.any()).optional(), // Recursive type
});

export const BreadcrumbSegment = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['class', 'folder']),
});
