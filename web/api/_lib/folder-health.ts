/**
 * Folder Health Metrics Helper
 * Provides health metrics for workspace folder system
 * Used by /api/health endpoint when ?details=true
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for admin queries
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface FolderHealthMetrics {
  avg_notes_per_folder: number;
  pct_uncategorized_notes: number;
  avg_folder_depth: number;
  duplicate_notes_detected: number;
}

/**
 * Get folder system health metrics
 * Returns aggregated statistics about folder usage and potential issues
 */
export async function getFolderHealthMetrics(): Promise<FolderHealthMetrics> {
  try {
    // Query 1: Average notes per folder
    const avgNotesQuery = `
      SELECT COALESCE(AVG(note_count), 0) AS avg_notes
      FROM (
        SELECT folder_id, COUNT(*) AS note_count
        FROM note_folders
        GROUP BY folder_id
      ) AS folder_note_counts;
    `;

    // Query 2: Percentage of uncategorized notes (last 30 days)
    const uncategorizedQuery = `
      SELECT
        COALESCE(
          (COUNT(*) FILTER (WHERE nf.note_id IS NULL) * 100.0 / NULLIF(COUNT(*), 0))::int,
          0
        ) AS pct_uncategorized
      FROM notes n
      LEFT JOIN note_folders nf ON n.id = nf.note_id
      WHERE n.created_at > now() - interval '30 days';
    `;

    // Query 3: Average folder depth (recursive CTE)
    const depthQuery = `
      WITH RECURSIVE folder_depths AS (
        -- Base case: root folders (no parent)
        SELECT id, parent_id, 1 AS depth
        FROM folders
        WHERE parent_id IS NULL

        UNION ALL

        -- Recursive case: children of known folders
        SELECT f.id, f.parent_id, fd.depth + 1
        FROM folders f
        INNER JOIN folder_depths fd ON f.parent_id = fd.id
        WHERE fd.depth < 20  -- Safety limit
      )
      SELECT COALESCE(AVG(depth), 0) AS avg_depth
      FROM folder_depths;
    `;

    // Query 4: Duplicate detection (notes in multiple folders per class)
    const duplicatesQuery = `
      SELECT COUNT(*) AS duplicate_count
      FROM (
        SELECT n.id, n.class_id
        FROM notes n
        INNER JOIN note_folders nf ON n.id = nf.note_id
        GROUP BY n.id, n.class_id
        HAVING COUNT(DISTINCT nf.folder_id) > 1
      ) AS duplicates;
    `;

    // Note: exec_sql RPC is not available in Supabase by default
    // Falling back to direct SQL implementation (see getFolderHealthMetricsDirectSQL)
    return await getFolderHealthMetricsDirectSQL();
  } catch (error) {
    console.error("FOLDER_HEALTH_METRICS_ERROR", error);

    // Return zero values on error - non-blocking
    return {
      avg_notes_per_folder: 0,
      pct_uncategorized_notes: 0,
      avg_folder_depth: 0,
      duplicate_notes_detected: 0,
    };
  }
}

/**
 * Alternative implementation using direct SQL queries
 * Use this if exec_sql RPC is not available
 */
export async function getFolderHealthMetricsDirectSQL(): Promise<FolderHealthMetrics> {
  try {
    // Query 1: Average notes per folder
    const { data: avgNotesData } = await supabase
      .from("note_folders")
      .select("folder_id");

    const folderCounts = new Map<string, number>();
    (avgNotesData || []).forEach(({ folder_id }) => {
      folderCounts.set(folder_id, (folderCounts.get(folder_id) || 0) + 1);
    });
    const avgNotes = folderCounts.size > 0
      ? Array.from(folderCounts.values()).reduce((a, b) => a + b, 0) / folderCounts.size
      : 0;

    // Query 2: Percentage uncategorized (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentNotes } = await supabase
      .from("notes")
      .select("id")
      .gte("created_at", thirtyDaysAgo);

    const { data: mappedNotes } = await supabase
      .from("note_folders")
      .select("note_id");

    const mappedNoteIds = new Set((mappedNotes || []).map(m => m.note_id));
    const totalRecent = (recentNotes || []).length;
    const uncategorized = (recentNotes || []).filter(n => !mappedNoteIds.has(n.id)).length;
    const pctUncategorized = totalRecent > 0 ? Math.round((uncategorized / totalRecent) * 100) : 0;

    // Query 3: Average folder depth (simplified - just count levels)
    const { data: folders } = await supabase
      .from("folders")
      .select("id, parent_id");

    const depths = new Map<string, number>();

    function calculateDepth(folderId: string, visited = new Set<string>()): number {
      if (depths.has(folderId)) return depths.get(folderId)!;
      if (visited.has(folderId)) return 0; // Circular ref safety

      visited.add(folderId);
      const folder = (folders || []).find(f => f.id === folderId);
      if (!folder || !folder.parent_id) {
        depths.set(folderId, 1);
        return 1;
      }

      const depth = 1 + calculateDepth(folder.parent_id, visited);
      depths.set(folderId, depth);
      return depth;
    }

    (folders || []).forEach(f => calculateDepth(f.id));
    const avgDepth = depths.size > 0
      ? Array.from(depths.values()).reduce((a, b) => a + b, 0) / depths.size
      : 0;

    // Query 4: Duplicate detection
    const noteFolderMap = new Map<string, Set<string>>();
    (avgNotesData || []).forEach(({ folder_id, note_id }: any) => {
      if (!noteFolderMap.has(note_id)) {
        noteFolderMap.set(note_id, new Set());
      }
      noteFolderMap.get(note_id)!.add(folder_id);
    });

    const duplicateCount = Array.from(noteFolderMap.values()).filter(folders => folders.size > 1).length;

    return {
      avg_notes_per_folder: Math.round(avgNotes * 10) / 10,
      pct_uncategorized_notes: pctUncategorized,
      avg_folder_depth: Math.round(avgDepth * 10) / 10,
      duplicate_notes_detected: duplicateCount,
    };
  } catch (error) {
    console.error("FOLDER_HEALTH_METRICS_DIRECT_ERROR", error);

    return {
      avg_notes_per_folder: 0,
      pct_uncategorized_notes: 0,
      avg_folder_depth: 0,
      duplicate_notes_detected: 0,
    };
  }
}
