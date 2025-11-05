// Purpose: Generate Quiz tool page - 3 modes: paste text, import file, or from class notes
// Connects to: /api/generate-quiz, quiz results

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { useNavigate } from "react-router-dom";

type ClassRow = { id: string; name: string };
type Mode = "direct" | "file" | "class";

export default function Generate() {
  const { push } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("direct");

  // classes (for class mode)
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string | null>(null);

  // direct mode
  const [directText, setDirectText] = useState("");

  // file mode
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");

  const [loading, setLoading] = useState(false);

  // load classes for class mode
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id,name")
        .order("created_at", { ascending: false });

      if (!alive) return;
      if (error) {
        console.error("GENERATE_LOAD_CLASSES_ERROR", error);
        setClasses([]);
      } else {
        setClasses(data ?? []);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // unified current text for direct/file
  const notesSource = useMemo(() => {
    if (mode === "direct") return directText.trim();
    if (mode === "file") return fileText.trim();
    return ""; // class mode resolves on submit
  }, [mode, directText, fileText]);

  async function extractTextFromFile(f: File) {
    const name = f.name.toLowerCase();
    // lightweight, safe support: .txt / .md
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      try {
        const text = await f.text();
        setFileText(text);
      } catch (err) {
        console.error("FILE_READ_ERROR", { file: f.name, error: err });
        push({ kind: "error", text: "Could not read file. Please try again." });
        setFile(null);
        setFileText("");
      }
      return;
    }
    // later (Phase 2): PDFs/Docs with server parsing
    setFile(null);
    setFileText("");
    push({ kind: "error", text: "Unsupported file format. Use .txt or .md, or paste text directly." });
  }

  async function buildClassNotesText(selectedClassId: string) {
    const { data, error } = await supabase
      .from("notes")
      .select("content")
      .eq("class_id", selectedClassId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("GENERATE_LOAD_NOTES_ERROR", { selectedClassId, error });
      return { text: "", ok: false };
    }
    const text = (data ?? []).map(n => n.content || "").join("\n\n").trim();
    return { text, ok: true };
  }

  async function submitGenerate() {
    setLoading(true);
    try {
      let notes_text = "";
      let quiz_class_id: string | null = null;

      if (mode === "direct") {
        if (!notesSource) {
          push({ kind: "error", text: "Paste your study material first." });
          setLoading(false);
          return;
        }
        notes_text = notesSource;
      } else if (mode === "file") {
        if (!notesSource) {
          push({ kind: "error", text: "Import a supported file or paste text." });
          setLoading(false);
          return;
        }
        notes_text = notesSource;
      } else {
        // class mode
        if (!classId) {
          push({ kind: "error", text: "Choose a class." });
          setLoading(false);
          return;
        }
        const { text, ok } = await buildClassNotesText(classId);
        if (!ok) {
          push({ kind: "error", text: "Could not load class notes." });
          setLoading(false);
          return;
        }
        if (!text) {
          push({ kind: "error", text: "This class has no notes yet." });
          setLoading(false);
          return;
        }
        notes_text = text;
        quiz_class_id = classId; // associate quiz with class
      }

      // auth token for RLS
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      if (!accessToken) {
        push({ kind: "error", text: "You are signed out. Please sign in again." });
        setLoading(false);
        return;
      }

      // Call quiz generator API
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          notes_text,
          class_id: quiz_class_id, // null for paste/file, string for class mode
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        console.error("GENERATE_API_ERROR", { status: res.status, payload });
        push({ kind: "error", text: payload?.message || "Failed to generate quiz." });
        setLoading(false);
        return;
      }

      const quizId: string | undefined = payload?.quiz_id || payload?.id;
      if (!quizId) {
        console.error("GENERATE_API_NO_ID", payload);
        push({ kind: "error", text: "Quiz created but no ID returned." });
        setLoading(false);
        return;
      }

      push({ kind: "success", text: "Quiz generated!" });
      navigate(`/quiz/${quizId}`);
    } catch (e: any) {
      console.error("GENERATE_SUBMIT_ERROR", e);
      push({ kind: "error", text: "Unexpected error. Please try again." });
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-[32px] font-semibold tracking-[-.2px] m-0 mb-2">Generate Quiz</h2>
          <p className="text-muted m-0">
            Create a quiz by pasting study material, importing a file, or pulling from an existing class.
          </p>
        </div>

        <div className="surface bdr radius p-6">
          {/* Mode switcher */}
          <div className="flex gap-2 mb-6">
            <button
              className={`btn ${mode === "direct" ? "primary" : "ghost"}`}
              onClick={() => setMode("direct")}
              aria-pressed={mode === "direct"}
            >
              Paste Text
            </button>
            <button
              className={`btn ${mode === "file" ? "primary" : "ghost"}`}
              onClick={() => setMode("file")}
              aria-pressed={mode === "file"}
            >
              Import File
            </button>
            <button
              className={`btn ${mode === "class" ? "primary" : "ghost"}`}
              onClick={() => setMode("class")}
              aria-pressed={mode === "class"}
            >
              From Class Notes
            </button>
          </div>

          {/* Mode panels */}
          {mode === "direct" && (
            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">Paste your study material</label>
              <textarea
                rows={12}
                className="w-full surface-2 bdr radius p-3 text-[14px]"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontFamily: "inherit"
                }}
                placeholder="Paste text here…"
                value={directText}
                onChange={(e) => setDirectText(e.target.value)}
              />
              {directText && (
                <div className="text-xs text-muted mt-2">
                  {directText.length.toLocaleString()} characters
                </div>
              )}
            </div>
          )}

          {mode === "file" && (
            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">Upload a .txt or .md file</label>
              <input
                type="file"
                accept=".txt,.md"
                className="block mb-3"
                onChange={async (e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  setFileText("");
                  if (f) await extractTextFromFile(f);
                }}
              />
              {file && (
                <div className="text-sm text-muted mb-3">
                  Selected: <span className="text-foreground font-medium">{file.name}</span>
                </div>
              )}
              {fileText && (
                <>
                  <div className="text-sm text-muted mb-2">Preview (editable)</div>
                  <textarea
                    rows={10}
                    className="w-full surface-2 bdr radius p-3 text-[14px]"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      fontFamily: "inherit"
                    }}
                    value={fileText}
                    onChange={(e) => setFileText(e.target.value)}
                  />
                  <div className="text-xs text-muted mt-2">
                    {fileText.length.toLocaleString()} characters
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "class" && (
            <div className="mb-6">
              <label className="text-sm text-muted block mb-2">Choose a class</label>
              <select
                className="surface-2 bdr radius p-2 text-[14px] w-full"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)"
                }}
                value={classId ?? ""}
                onChange={(e) => setClassId(e.target.value || null)}
              >
                <option value="">— Select —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted mt-3 mb-0">
                We'll combine all notes in the selected class to build your quiz.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn primary" onClick={submitGenerate} disabled={loading} aria-busy={loading}>
              {loading ? "Generating…" : "Generate Quiz"}
            </button>
            <button className="btn ghost" onClick={() => navigate("/")}>
              Back
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
