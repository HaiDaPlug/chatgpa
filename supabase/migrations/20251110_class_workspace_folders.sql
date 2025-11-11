-- =====================================================
-- Migration: Class Workspace Folders System (Section 5)
-- Date: 2025-11-10
-- Purpose: Add folder organization for notes within classes
-- =====================================================

-- =====================================================
-- 1. CREATE FOLDERS TABLE
-- =====================================================

CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  sort_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE folders IS 'Folder hierarchy for organizing notes within classes. Supports nested folders via parent_id.';
COMMENT ON COLUMN folders.parent_id IS 'Self-referential FK for nested folders. NULL = root-level folder.';
COMMENT ON COLUMN folders.sort_index IS 'Integer ordering within parent. Use gaps (100, 200, 300) for easy reordering.';

-- =====================================================
-- 2. CREATE NOTE_FOLDERS MAPPING TABLE
-- =====================================================

CREATE TABLE note_folders (
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, folder_id)
);

-- Add comment for documentation
COMMENT ON TABLE note_folders IS 'Many-to-many mapping between notes and folders. Currently 1:1 (one folder per note), schema flexible for future tags.';
COMMENT ON COLUMN note_folders.user_id IS 'Denormalized user_id for RLS performance. Must match note.user_id and folder.user_id.';

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

-- Folders indexes
CREATE INDEX idx_folders_user_class ON folders(user_id, class_id, parent_id, sort_index);
CREATE INDEX idx_folders_class ON folders(class_id);
CREATE INDEX idx_folders_parent ON folders(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_folders_updated_at ON folders(updated_at DESC);

-- Note_folders indexes
CREATE INDEX idx_note_folders_user_folder ON note_folders(user_id, folder_id);
CREATE INDEX idx_note_folders_user_note ON note_folders(user_id, note_id);
CREATE INDEX idx_note_folders_folder ON note_folders(folder_id);

-- =====================================================
-- 4. CREATE TRIGGERS
-- =====================================================

-- Auto-update folders.updated_at on any change
CREATE TRIGGER trigger_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_folders ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. CREATE RLS POLICIES - FOLDERS
-- =====================================================

-- SELECT: Users can view their own folders
CREATE POLICY folders_select_own ON folders
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can create folders in their own classes
CREATE POLICY folders_insert_own ON folders
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = folders.class_id
      AND classes.user_id = auth.uid()
    )
  );

-- UPDATE: Users can update their own folders
CREATE POLICY folders_update_own ON folders
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own folders
CREATE POLICY folders_delete_own ON folders
  FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 7. CREATE RLS POLICIES - NOTE_FOLDERS
-- =====================================================

-- SELECT: Users can view their own note-folder mappings
CREATE POLICY note_folders_select_own ON note_folders
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can map their own notes to their own folders
CREATE POLICY note_folders_insert_own ON note_folders
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_folders.note_id
      AND notes.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM folders
      WHERE folders.id = note_folders.folder_id
      AND folders.user_id = auth.uid()
    )
  );

-- DELETE: Users can remove their own note-folder mappings
CREATE POLICY note_folders_delete_own ON note_folders
  FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- 8. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get all descendant folder IDs (recursive)
-- Uses SECURITY INVOKER to respect RLS policies (user can only see their own folders)
CREATE OR REPLACE FUNCTION get_descendant_folders(parent_folder_id uuid)
RETURNS TABLE(folder_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    -- Base case: the parent folder itself (RLS enforced)
    SELECT id FROM folders WHERE id = parent_folder_id AND user_id = auth.uid()

    UNION ALL

    -- Recursive case: children of descendants (RLS enforced)
    SELECT f.id
    FROM folders f
    INNER JOIN descendants d ON f.parent_id = d.id
    WHERE f.user_id = auth.uid()
  )
  SELECT id FROM descendants;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

COMMENT ON FUNCTION get_descendant_folders IS 'Returns all descendant folder IDs (including self) for recursive queries. Used by quiz generation folder filter.';

-- Function to check for circular parent references
CREATE OR REPLACE FUNCTION check_folder_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
  ancestor_id uuid;
BEGIN
  -- If parent_id is NULL, no cycle possible
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If parent_id equals own id, reject immediately
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Folder cannot be its own parent';
  END IF;

  -- Walk up the tree to check for cycles
  ancestor_id := NEW.parent_id;
  WHILE ancestor_id IS NOT NULL LOOP
    -- If we encounter our own ID, there's a cycle
    IF ancestor_id = NEW.id THEN
      RAISE EXCEPTION 'Circular folder reference detected';
    END IF;

    -- Move to next ancestor
    SELECT parent_id INTO ancestor_id
    FROM folders
    WHERE id = ancestor_id;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_folder_circular_reference IS 'Trigger function to prevent circular parent references in folders table.';

-- Create trigger for circular reference check
CREATE TRIGGER trigger_folders_no_circular_refs
  BEFORE INSERT OR UPDATE OF parent_id ON folders
  FOR EACH ROW
  EXECUTE FUNCTION check_folder_circular_reference();

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

-- Grant usage on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_descendant_folders(uuid) TO authenticated;

-- =====================================================
-- 10. BACKFILL STRATEGY
-- =====================================================

-- No backfill needed - existing notes remain unmapped
-- They will appear in "Uncategorized" view (WHERE NOT EXISTS in note_folders)
-- This is a zero-downtime, opt-in migration

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables created
DO $$
BEGIN
  ASSERT (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'folders' AND schemaname = 'public')), 'folders table not created';
  ASSERT (SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'note_folders' AND schemaname = 'public')), 'note_folders table not created';
  RAISE NOTICE 'Section 5 migration complete: folders and note_folders tables created with RLS';
END $$;
