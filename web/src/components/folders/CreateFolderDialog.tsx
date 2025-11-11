/**
 * CreateFolderDialog Component
 * Dialog for creating new folders
 */

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  parentId: string | null;
  parentName?: string;
  onSuccess: () => void;
}

export default function CreateFolderDialog({
  isOpen,
  onClose,
  classId,
  parentId,
  parentName,
  onSuccess,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
    }
  }, [isOpen]);

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

    setLoading(true);
    setError(null);

    try {
      // Get auth token
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/folders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          class_id: classId,
          parent_id: parentId,
          name: name.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create folder");
      }

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("CREATE_FOLDER_ERROR", err);
      setError(err.message || "Failed to create folder");
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
          <h2 className="dialog-title">Create Folder</h2>
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
            {/* Parent info */}
            {parentName && (
              <p className="text-sm text-muted mb-4">
                Creating subfolder in <strong>{parentName}</strong>
              </p>
            )}

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
                placeholder="e.g., Week 1, Lectures, Study Materials"
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
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
