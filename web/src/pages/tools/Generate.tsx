// Purpose: Generate Quiz tool page - class selector with real notes integration
// Connects to: Dashboard, ClassNotes, /api/generate-quiz, quiz results

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useNavigate, Link } from "react-router-dom";

type ClassRow = { id: string; name: string };
type NoteRow = { content: string };

export default function Generate() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);

  // Fetch user's classes
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setClasses(data ?? []);
      setSelected((data?.[0]?.id) ?? "");
      setLoading(false);
    })();
  }, []);

  // Fetch note count for selected class
  useEffect(() => {
    if (!selected) { setNoteCount(null); return; }
    (async () => {
      const { count, error } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("class_id", selected);
      if (error) console.error(error);
      setNoteCount(count ?? 0);
    })();
  }, [selected]);

  const selectedClass = useMemo(
    () => classes.find(c => c.id === selected),
    [classes, selected]
  );

  async function onGenerate() {
    if (!selected) {
      push({ kind: "error", text: "Choose a class first." });
      return;
    }
    setGenLoading(true);

    // Get notes for class
    const { data: notes, error: notesErr } = await supabase
      .from("notes")
      .select("content")
      .eq("class_id", selected);

    if (notesErr) {
      setGenLoading(false);
      push({ kind: "error", text: "Could not load notes." });
      return;
    }

    const notes_text = (notes ?? []).map((n: NoteRow) => n.content).join("\n\n").trim();
    if (!notes_text) {
      setGenLoading(false);
      push({ kind: "error", text: "No notes in this class. Add notes first." });
      return;
    }

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      setGenLoading(false);
      push({ kind: "error", text: "You're signed out. Please sign in again." });
      return;
    }

    const res = await fetch("/api/generate-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ class_id: selected, notes_text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Failed to generate quiz." }));
      setGenLoading(false);
      push({ kind: "error", text: err.message || "Failed to generate quiz." });
      return;
    }

    const { quiz_id } = await res.json();
    setGenLoading(false);
    push({ kind: "success", text: "Quiz generated." });
    navigate(quiz_id ? `/quiz/${quiz_id}` : "/results");
  }

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0 mb-2">Generate Quiz</h2>
        <p className="text-muted m-0">Pick a class and we'll use its notes to generate a quiz.</p>
      </div>

      <Card>
        <div className="p-4">
          {/* Class selector */}
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginBottom: "var(--space-3)" }}>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{
                padding: "var(--space-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "var(--surface-2)",
                color: "var(--text)",
                flex: 1
              }}
              disabled={loading || classes.length === 0}
            >
              {classes.length === 0 && <option value="">No classes yet</option>}
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <button className="btn primary" onClick={onGenerate} disabled={!selected || genLoading}>
              {genLoading ? "Generating…" : "Generate"}
            </button>
          </div>

          {/* Notes info */}
          {selected && (
            <div className="surface-2 bdr radius p-3">
              <div style={{ marginBottom: "var(--space-2)" }}>
                <strong>Notes in {selectedClass?.name || "class"}:</strong>{" "}
                <span className="text-muted">{noteCount ?? "—"}</span>
              </div>
              <div className="text-muted" style={{ fontSize: "14px", marginBottom: "var(--space-2)" }}>
                {noteCount
                  ? "Add more notes to improve quiz quality."
                  : "No notes yet — add some before generating."}
              </div>
              <div>
                <Link className="btn ghost" to={`/classes/${selected}/notes`}>
                  Add Notes
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
