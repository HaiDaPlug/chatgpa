/**
 * RenameFolderDialog Component
 * Dialog for renaming folders
 */

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface RenameFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  currentName: string;
  onSuccess: () => void;
}

export default function RenameFolderDialog({
  isOpen,
  onClose,
  folderId,
  currentName,
  onSuccess,
}: RenameFolderDialogProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Folder name is required");
      return;
    }

    if (name.length > 64) {
      setError("Folder name must be 64 characters or less");
      return;
    }

    if (name.trim() === currentName) {
      // No change
      onClose();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/folders/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          folder_id: folderId,
          name: name.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to rename folder");
      }

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("RENAME_FOLDER_ERROR", err);
      setError(err.message || "Failed to rename folder");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2 className="dialog-title">Rename Folder</h2>
          <button
            className="dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            {/* Name input */}
            <div className="form-field">
              <label htmlFor="folder-name" className="form-label">
                Folder Name
              </label>
              <input
                id="folder-name"
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={64}
                autoFocus
                disabled={loading}
              />
              <p className="form-help">
                {name.length}/64 characters
              </p>
            </div>

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
              type="submit"
              className="btn primary"
              disabled={loading || !name.trim() || name.trim() === currentName}
            >
              {loading ? "Renaming..." : "Rename"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
