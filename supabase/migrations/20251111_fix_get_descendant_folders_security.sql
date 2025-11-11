-- =====================================================
-- Migration: Fix get_descendant_folders RPC Security
-- Date: 2025-11-11
-- Purpose: Change from SECURITY DEFINER to SECURITY INVOKER
--          to respect RLS policies and prevent cross-user enumeration
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_descendant_folders(uuid);

-- Recreate with SECURITY INVOKER and explicit user_id checks
CREATE OR REPLACE FUNCTION get_descendant_folders(parent_folder_id uuid)
RETURNS TABLE(folder_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    -- Base case: the parent folder itself (RLS enforced via user_id check)
    SELECT id FROM folders
    WHERE id = parent_folder_id
    AND user_id = auth.uid()

    UNION ALL

    -- Recursive case: children of descendants (RLS enforced via user_id check)
    SELECT f.id
    FROM folders f
    INNER JOIN descendants d ON f.parent_id = d.id
    WHERE f.user_id = auth.uid()
  )
  SELECT id FROM descendants;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

COMMENT ON FUNCTION get_descendant_folders IS 'Returns all descendant folder IDs (including self) for recursive queries. Respects RLS - only returns folders owned by authenticated user.';

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_descendant_folders(uuid) TO authenticated;
