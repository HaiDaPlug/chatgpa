import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/Toast";

type ClassRow = { id: string; name: string };

export default function GeneratePage() {
  const nav = useNavigate();
  const { push } = useToast();
  const [params] = useSearchParams();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("classes").select("id,name").order("created_at");
      if (error) push({ type: "error", message: "Failed to load classes." });
      setClasses(data ?? []);
      const pre = params.get("class");
      if (pre) setClassId(pre);
    })();
  }, [push, params]);

  const relevance = useMemo(() => {
    // Lightweight heuristic until we wire a true validator
    const lenScore = Math.min(notes.length / 800, 1);
    const headings = (notes.match(/\n#{1,6}\s|\n[A-Z][A-Z ]{3,}\n/g) || []).length;
    const headingScore = Math.min(headings / 4, 1);
    return Math.round((0.7 * lenScore + 0.3 * headingScore) * 100);
  }, [notes]);

  async function onGenerate() {
    try {
      setBusy(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token!;
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ class_id: classId, notes_text: notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        push({ type: "error", message: json?.message || json?.code || "Failed to generate." });
        return;
      }
      push({ type: "success", message: "Quiz created!" });
      nav(`/quiz/${json.quiz_id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Generate a quiz</h1>
        <p className="text-sm text-stone-400">Paste your notes. We’ll create questions that match your material.</p>
      </header>

      <label className="mb-2 block text-sm font-medium">Class</label>
      <select
        className="mb-4 w-full rounded-xl border border-stone-800 bg-stone-900 p-3 text-stone-100"
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
      >
        <option value="">Select a class…</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label className="mb-2 block text-sm font-medium">Notes</label>
      <textarea
        className="h-56 w-full rounded-2xl border border-stone-800 bg-stone-900 p-4 text-stone-100 placeholder-stone-500"
        placeholder="Paste your notes here…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="mt-3 flex items-center justify-between">
        <RelevanceMeter value={relevance} />
        <button
          disabled={!classId || notes.trim().length < 20 || busy}
          onClick={onGenerate}
          className="rounded-xl bg-coral-500 px-4 py-2 font-medium text-white disabled:opacity-60 hover:bg-coral-400 transition"
        >
          {busy ? "Generating…" : "Generate quiz"}
        </button>
      </div>
    </div>
  );
}

function RelevanceMeter({ value }: { value: number }) {
  const label = value > 80 ? "High" : value > 50 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 rounded-full bg-stone-800">
        <div
          className="h-2 rounded-full bg-coral-500 transition-all"
          style={{ width: `${Math.max(6, value)}%` }}
        />
      </div>
      <span className="text-sm text-stone-300">{label} relevance</span>
    </div>
  );
}
