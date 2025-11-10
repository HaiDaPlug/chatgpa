/**
 * DeleteFolderDialog Component
 * Dialog for deleting folders with cascade options
 */

import { useState, useEffect } from "react";
import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface DeleteFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folderName: string;
  noteCount: number;
  hasChildren: boolean;
  onSuccess: () => void;
}

type CascadeMode = "move-to-parent" | "move-to-uncategorized" | null;

export default function DeleteFolderDialog({
  isOpen,
  onClose,
  folderId,
  folderName,
  noteCount,
  hasChildren,
  onSuccess,
}: DeleteFolderDialogProps) {
  const [cascadeMode, setCascadeMode] = useState<CascadeMode>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = noteCount === 0 && !hasChildren;
  const canDelete = isEmpty || cascadeMode !== null;

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCascadeMode(null);
      setError(null);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Build query string
      const params = new URLSearchParams({ folder_id: folderId });
      if (cascadeMode) {
        params.append("cascade", cascadeMode);
      }

      const response = await fetch(`/api/folders/delete?${params}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete folder");
      }

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("DELETE_FOLDER_ERROR", err);
      setError(err.message || "Failed to delete folder");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2 className="dialog-title">Delete Folder</h2>
          <button
            className="dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="dialog-body">
          {/* Warning */}
          <div className="warning-box">
            <ExclamationTriangleIcon className="w-5 h-5 text-warning" />
            <p>
              Are you sure you want to delete <strong>{folderName}</strong>?
            </p>
          </div>

          {/* Folder contents info */}
          {!isEmpty && (
            <div className="folder-contents-info">
              <p className="text-sm text-muted">This folder contains:</p>
              <ul className="contents-list">
                {noteCount > 0 && (
                  <li>
                    {noteCount} {noteCount === 1 ? "note" : "notes"}
                  </li>
                )}
                {hasChildren && <li>Subfolders</li>}
              </ul>
            </div>
          )}

          {/* Cascade options */}
          {!isEmpty && (
            <div className="cascade-options">
              <p className="text-sm font-medium mb-2">What should happen to the contents?</p>

              <label className="cascade-option">
                <input
                  type="radio"
                  name="cascade"
                  value="move-to-parent"
                  checked={cascadeMode === "move-to-parent"}
                  onChange={() => setCascadeMode("move-to-parent")}
                  disabled={loading}
                />
                <div>
                  <span className="option-title">Move to parent folder</span>
                  <span className="option-description">
                    Contents will move one level up
                  </span>
                </div>
              </label>

              <label className="cascade-option">
                <input
                  type="radio"
                  name="cascade"
                  value="move-to-uncategorized"
                  checked={cascadeMode === "move-to-uncategorized"}
                  onChange={() => setCascadeMode("move-to-uncategorized")}
                  disabled={loading}
                />
                <div>
                  <span className="option-title">Move to Uncategorized</span>
                  <span className="option-description">
                    Contents will be uncategorized
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dialog-footer">
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={handleDelete}
            disabled={loading || !canDelete}
          >
            {loading ? "Deleting..." : "Delete Folder"}
          </button>
        </div>
      </div>
    </div>
  );
}
