/**
 * FolderTree Component
 * Displays expandable/collapsible folder hierarchy with actions
 */

import { useState, useEffect } from "react";
import { Folder } from "../../shared/types";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon, FolderOpenIcon } from "@heroicons/react/24/outline";
import { PlusIcon, EllipsisVerticalIcon } from "@heroicons/react/20/solid";

interface FolderTreeProps {
  classId: string;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRefresh?: () => void;
}

interface FolderNodeProps {
  folder: Folder;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  onSelect: (folderId: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (folderId: string) => void;
  onDelete: (folderId: string) => void;
}

interface FolderNodeContainerProps {
  folder: Folder;
  level: number;
  selectedFolderId: string | null;
  onToggle: (folderId: string) => void;
  onSelect: (folderId: string) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (folderId: string) => void;
  onDelete: (folderId: string) => void;
}

/**
 * Individual folder node with children
 */
function FolderNode({
  folder,
  level,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: FolderNodeProps) {
  const [showActions, setShowActions] = useState(false);
  const hasChildren = folder.children && folder.children.length > 0;
  const noteCount = folder.note_count || 0;

  return (
    <div className="folder-node">
      {/* Folder row */}
      <div
        className={`folder-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Expand/collapse chevron */}
        <button
          className="chevron-btn"
          onClick={() => onToggle(folder.id)}
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          style={{ opacity: hasChildren ? 1 : 0, pointerEvents: hasChildren ? "auto" : "none" }}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronRightIcon className="w-4 h-4" />
          )}
        </button>

        {/* Folder icon */}
        <div className="folder-icon">
          {isExpanded ? (
            <FolderOpenIcon className="w-5 h-5 text-primary" />
          ) : (
            <FolderIcon className="w-5 h-5 text-muted" />
          )}
        </div>

        {/* Folder name */}
        <button
          className="folder-name"
          onClick={() => onSelect(folder.id)}
          title={folder.name}
        >
          {folder.name}
        </button>

        {/* Note count badge */}
        {noteCount > 0 && (
          <span className="note-count-badge" title={`${noteCount} notes`}>
            {noteCount}
          </span>
        )}

        {/* Actions menu (visible on hover) */}
        {showActions && (
          <div className="folder-actions">
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(folder.id);
              }}
              title="New subfolder"
              aria-label="Create subfolder"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Show dropdown menu with Rename/Delete
                onRename(folder.id);
              }}
              title="More actions"
              aria-label="More actions"
            >
              <EllipsisVerticalIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Children (recursive) */}
      {isExpanded && hasChildren && (
        <div className="folder-children">
          {folder.children!.map((child) => (
            <FolderNodeContainer
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={isSelected ? folder.id : null}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Container for FolderNode with expanded state management
 */
function FolderNodeContainer({
  folder,
  level,
  selectedFolderId,
  onToggle,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
}: FolderNodeContainerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(`folder_tree_expanded_${folder.class_id}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  const handleToggle = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
    localStorage.setItem(
      `folder_tree_expanded_${folder.class_id}`,
      JSON.stringify([...newExpanded])
    );
  };

  return (
    <FolderNode
      folder={folder}
      level={level}
      isSelected={isSelected}
      isExpanded={isExpanded}
      onToggle={handleToggle}
      onSelect={onSelect}
      onCreateChild={onCreateChild}
      onRename={onRename}
      onDelete={onDelete}
    />
  );
}

/**
 * Main FolderTree component
 */
export default function FolderTree({
  classId,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRefresh,
}: FolderTreeProps) {
  const [tree, setTree] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  // Fetch folder tree
  useEffect(() => {
    fetchTree();
  }, [classId]);

  const fetchTree = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Fetch tree
      const response = await fetch(
        `/api/folders/tree?class_id=${classId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load folders");
      }

      const data = await response.json();
      setTree(data.tree || []);

      // Fetch uncategorized count
      const uncatResponse = await fetch(
        `/api/classes/notes-uncategorized?class_id=${classId}&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (uncatResponse.ok) {
        const uncatData = await uncatResponse.json();
        setUncategorizedCount(uncatData.notes?.length || 0);
      }
    } catch (err: any) {
      console.error("FOLDER_TREE_FETCH_ERROR", err);
      setError(err.message || "Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  // Handle folder selection
  const handleSelectFolder = (folderId: string | null) => {
    onSelectFolder(folderId);
  };

  if (loading) {
    return (
      <div className="folder-tree loading">
        <div className="skeleton-folder" />
        <div className="skeleton-folder" />
        <div className="skeleton-folder" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="folder-tree error">
        <p className="text-error">{error}</p>
        <button className="btn ghost" onClick={fetchTree}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="folder-tree">
      {/* Header */}
      <div className="tree-header">
        <h3 className="tree-title">Folders</h3>
        <button
          className="btn ghost sm"
          onClick={() => onCreateFolder(null)}
          title="New folder"
          aria-label="Create new folder"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Tree content */}
      <div className="tree-content">
        {/* Uncategorized (special node) */}
        <div
          className={`folder-row uncategorized ${
            selectedFolderId === null ? "selected" : ""
          }`}
          onClick={() => handleSelectFolder(null)}
        >
          <div className="folder-icon">
            <FolderIcon className="w-5 h-5 text-muted" />
          </div>
          <span className="folder-name">Uncategorized</span>
          {uncategorizedCount > 0 && (
            <span className="note-count-badge">{uncategorizedCount}</span>
          )}
        </div>

        {/* Folder tree */}
        {tree.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">No folders yet</p>
            <button className="btn ghost sm" onClick={() => onCreateFolder(null)}>
              Create first folder
            </button>
          </div>
        ) : (
          tree.map((folder) => (
            <FolderNodeContainer
              key={folder.id}
              folder={folder}
              level={0}
              selectedFolderId={selectedFolderId}
              onToggle={() => {}}
              onSelect={handleSelectFolder}
              onCreateChild={onCreateFolder}
              onRename={onRenameFolder}
              onDelete={onDeleteFolder}
            />
          ))
        )}
      </div>
    </div>
  );
}
