import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/Card";
import { useToast } from "@/lib/toast";

type Note = { id: string; content: string; created_at: string };

export default function ClassNotes() {
  const { id: classId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!classId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("id, content, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      push({ kind: "error", text: "Could not load notes." });
      setNotes([]);
    } else {
      setNotes(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function addNote() {
    if (!classId || !content.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("notes")
      .insert([{ class_id: classId, content }]);
    setSaving(false);

    if (error) {
      console.error(error);
      push({ kind: "error", text: "Could not save note." });
      return;
    }
    setContent("");
    push({ kind: "success", text: "Note added." });
    await load();
  }

  return (
    <PageShell>
      <section className="mb-6">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0">Class Notes</h2>
          <small className="text-muted">Add notes to generate quizzes</small>
        </div>

        <div className="surface bdr radius elev-1 p-6 mb-6">
          <p className="text-sm text-muted m-0 mb-4">
            Paste or type your notes for this class. They'll be used when you generate a quiz.
          </p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste notes here…"
            rows={8}
            className="w-full p-3 bdr radius mb-3"
            style={{
              background: "var(--surface-2)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontFamily: "inherit"
            }}
          />
          <div className="flex gap-2">
            <button className="btn" onClick={addNote} disabled={!content.trim() || saving}>
              {saving ? "Saving…" : "Add Note"}
            </button>
            <button className="btn ghost" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </button>
          </div>
        </div>

        {loading && (
          <div className="surface bdr radius elev-1 p-8 text-center">
            <p className="text-muted m-0">Loading notes...</p>
          </div>
        )}

        {!loading && notes.length === 0 && (
          <div className="surface bdr radius elev-1 p-8 text-center">
            <h3 className="text-[18px] font-semibold m-0 mb-1">No notes yet</h3>
            <p className="text-sm text-muted m-0">Add your first note above to get started.</p>
          </div>
        )}

        {!loading && notes.length > 0 && (
          <div className="grid gap-4">
            {notes.map((n) => (
              <Card key={n.id} title={`Note from ${new Date(n.created_at).toLocaleDateString()}`}>
                <div className="mt-2">
                  <pre className="text-sm" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                    {n.content}
                  </pre>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
