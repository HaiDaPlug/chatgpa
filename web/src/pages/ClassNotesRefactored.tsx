/**
 * ClassNotes Page - Refactored for Section 5
 * Two-column layout with folder tree and note management
 */

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/lib/toast";
import FolderTree from "@/components/FolderTree";
import CreateFolderDialog from "@/components/folders/CreateFolderDialog";
import RenameFolderDialog from "@/components/folders/RenameFolderDialog";
import DeleteFolderDialog from "@/components/folders/DeleteFolderDialog";
import { Note, BreadcrumbSegment } from "../../shared/types";
import { ChevronRightIcon, PlusIcon, EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import "../components/FolderTree.css";
import "../components/folders/dialog-styles.css";
import "./ClassNotes.css";

export default function ClassNotes() {
  const { id: classId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();

  // State
  const [className, setClassName] = useState<string>("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbSegment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogParentId, setCreateDialogParentId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameDialogFolderId, setRenameDialogFolderId] = useState<string>("");
  const [renameDialogCurrentName, setRenameDialogCurrentName] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogFolderId, setDeleteDialogFolderId] = useState<string>("");
  const [deleteDialogFolderName, setDeleteDialogFolderName] = useState<string>("");
  const [deleteDialogNoteCount, setDeleteDialogNoteCount] = useState(0);
  const [deleteDialogHasChildren, setDeleteDialogHasChildren] = useState(false);

  // Feature flag
  const workspaceFoldersEnabled = import.meta.env.VITE_FEATURE_WORKSPACE_FOLDERS === "true";

  // Load class name
  useEffect(() => {
    if (!classId) return;
    loadClassName();
  }, [classId]);

  // Load breadcrumb when folder changes
  useEffect(() => {
    if (!classId) return;
    loadBreadcrumb();
  }, [classId, selectedFolderId]);

  // Load notes when folder changes
  useEffect(() => {
    if (!classId) return;
    loadNotes();
  }, [classId, selectedFolderId]);

  async function loadClassName() {
    const { data, error } = await supabase
      .from("classes")
      .select("name")
      .eq("id", classId!)
      .single();

    if (error) {
      console.error("CLASS_NAME_FETCH_ERROR", error);
      setClassName("Class");
    } else {
      setClassName(data.name);
    }
  }

  async function loadBreadcrumb() {
    if (!selectedFolderId) {
      // Root level - just class name
      setBreadcrumb([
        { id: classId!, name: className || "Class", type: "class" },
      ]);
      return;
    }

    try {
      const token = localStorage.getItem("supabase.auth.token");
      if (!token) return;

      const response = await fetch(`/api/folders/path?folder_id=${selectedFolderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBreadcrumb(data.path || []);
      }
    } catch (err) {
      console.error("BREADCRUMB_FETCH_ERROR", err);
    }
  }

  async function loadNotes() {
    setLoading(true);

    try {
      let data: Note[] = [];

      if (!workspaceFoldersEnabled) {
        // Feature disabled - load all notes (old behavior)
        const { data: notesData, error } = await supabase
          .from("notes")
          .select("id, user_id, class_id, content, title, source_type, path, created_at")
          .eq("class_id", classId!)
          .order("created_at", { ascending: false });

        if (error) throw error;
        data = notesData || [];
      } else if (selectedFolderId === null) {
        // Uncategorized notes
        const token = localStorage.getItem("supabase.auth.token");
        if (!token) throw new Error("Not authenticated");

        const response = await fetch(
          `/api/classes/notes-uncategorized?class_id=${classId}&limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error("Failed to load notes");
        const result = await response.json();
        data = result.notes || [];
      } else {
        // Notes in selected folder
        const token = localStorage.getItem("supabase.auth.token");
        if (!token) throw new Error("Not authenticated");

        const response = await fetch(
          `/api/folders/notes?folder_id=${selectedFolderId}&limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error("Failed to load notes");
        const result = await response.json();
        data = result.notes || [];
      }

      setNotes(data);
    } catch (err: any) {
      console.error("NOTES_FETCH_ERROR", err);
      push({ kind: "error", text: err.message || "Could not load notes." });
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  // Folder dialog handlers
  const handleCreateFolder = (parentId: string | null) => {
    setCreateDialogParentId(parentId);
    setCreateDialogOpen(true);
  };

  const handleRenameFolder = (folderId: string) => {
    // TODO: Fetch folder name
    setRenameDialogFolderId(folderId);
    setRenameDialogCurrentName("Folder"); // Placeholder
    setRenameDialogOpen(true);
  };

  const handleDeleteFolder = (folderId: string) => {
    // TODO: Fetch folder details
    setDeleteDialogFolderId(folderId);
    setDeleteDialogFolderName("Folder"); // Placeholder
    setDeleteDialogNoteCount(0);
    setDeleteDialogHasChildren(false);
    setDeleteDialogOpen(true);
  };

  const handleFolderDialogSuccess = () => {
    // Refresh tree and notes
    loadNotes();
  };

  // Navigate to Generate Quiz with folder filter
  const handleGenerateQuiz = () => {
    const params = new URLSearchParams({
      class: classId!,
      ...(selectedFolderId && { folder: selectedFolderId }),
    });
    navigate(`/tools/generate?${params}`);
  };

  return (
    <PageShell>
      <div className="class-notes-container">
        {workspaceFoldersEnabled ? (
          <>
            {/* Two-column layout */}
            <div className="notes-layout">
              {/* Left pane: Folder tree */}
              <aside className="folder-pane">
                <FolderTree
                  classId={classId!}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                  onCreateFolder={handleCreateFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onRefresh={loadNotes}
                />
              </aside>

              {/* Right pane: Notes list */}
              <main className="notes-pane">
                {/* Breadcrumb */}
                <div className="breadcrumb">
                  {breadcrumb.map((segment, index) => (
                    <span key={segment.id} className="breadcrumb-segment">
                      {index > 0 && <ChevronRightIcon className="w-4 h-4 text-muted" />}
                      {index < breadcrumb.length - 1 ? (
                        <button
                          className="breadcrumb-link"
                          onClick={() => {
                            if (segment.type === "class") {
                              setSelectedFolderId(null);
                            } else {
                              setSelectedFolderId(segment.id);
                            }
                          }}
                        >
                          {segment.name}
                        </button>
                      ) : (
                        <span className="breadcrumb-current">{segment.name}</span>
                      )}
                    </span>
                  ))}
                </div>

                {/* Action bar */}
                <div className="action-bar">
                  <button className="btn primary" onClick={() => push({ kind: "info", text: "Add note coming soon" })}>
                    <PlusIcon className="w-4 h-4" />
                    Add Note
                  </button>
                  <button className="btn ghost" onClick={() => push({ kind: "info", text: "Import coming soon" })}>
                    Import File
                  </button>
                  <button className="btn ghost" onClick={handleGenerateQuiz}>
                    Generate Quiz
                  </button>
                </div>

                {/* Notes list */}
                {loading ? (
                  <div className="notes-loading">
                    <div className="skeleton-note" />
                    <div className="skeleton-note" />
                    <div className="skeleton-note" />
                  </div>
                ) : notes.length === 0 ? (
                  <div className="notes-empty">
                    <h3>No notes yet</h3>
                    <p>Add your first note or import files to get started.</p>
                    <button className="btn primary" onClick={() => push({ kind: "info", text: "Add note coming soon" })}>
                      <PlusIcon className="w-4 h-4" />
                      Add Note
                    </button>
                  </div>
                ) : (
                  <div className="notes-grid">
                    {notes.map((note) => (
                      <div key={note.id} className="note-card">
                        <div className="note-header">
                          <h4 className="note-title">
                            {note.title || `Note from ${new Date(note.created_at).toLocaleDateString()}`}
                          </h4>
                          <button className="note-actions-btn" aria-label="Note actions">
                            <EllipsisVerticalIcon className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="note-content">
                          <pre>{note.content.slice(0, 200)}{note.content.length > 200 ? "..." : ""}</pre>
                        </div>
                        <div className="note-footer">
                          <span className="note-date">
                            {new Date(note.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </main>
            </div>

            {/* Dialogs */}
            <CreateFolderDialog
              isOpen={createDialogOpen}
              onClose={() => setCreateDialogOpen(false)}
              classId={classId!}
              parentId={createDialogParentId}
              onSuccess={handleFolderDialogSuccess}
            />

            <RenameFolderDialog
              isOpen={renameDialogOpen}
              onClose={() => setRenameDialogOpen(false)}
              folderId={renameDialogFolderId}
              currentName={renameDialogCurrentName}
              onSuccess={handleFolderDialogSuccess}
            />

            <DeleteFolderDialog
              isOpen={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              folderId={deleteDialogFolderId}
              folderName={deleteDialogFolderName}
              noteCount={deleteDialogNoteCount}
              hasChildren={deleteDialogHasChildren}
              onSuccess={handleFolderDialogSuccess}
            />
          </>
        ) : (
          /* Feature disabled - show old UI */
          <div className="legacy-layout">
            <h2>Class Notes</h2>
            <p className="text-muted">Workspace folders feature is disabled. Enable VITE_FEATURE_WORKSPACE_FOLDERS to use folders.</p>
            {/* Old notes list here */}
            <div className="notes-grid">
              {notes.map((note) => (
                <div key={note.id} className="note-card">
                  <pre>{note.content}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
