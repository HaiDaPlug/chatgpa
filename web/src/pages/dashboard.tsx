import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { useToast } from "@/components/Toast";

type Clazz = { id: string; name: string; description?: string | null };
type Attempt = { id: string; score: number; created_at: string; quizzes: { id: string } };

function getLetterGradeFromFraction(score: number): string {
  const pct = Math.round(score * 100);
  if (pct >= 97) return "A+";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

export default function DashboardPage() {
  const [classes, setClasses] = useState<Clazz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const { push } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cls, error: ce }, { data: att, error: ae }] = await Promise.all([
        supabase.from("classes").select("id,name,description").order("created_at", { ascending: true }),
        supabase.from("quiz_attempts").select("id,score,created_at,quizzes!inner(id)").order("created_at", { ascending: false }).limit(5),
      ]);
      if (ce) push({ type: "error", message: "Failed to load classes." });
      if (ae) push({ type: "error", message: "Failed to load recent attempts." });
      setClasses(cls ?? []);
      setAttempts((att ?? []) as unknown as Attempt[]);
      setLoading(false);
    })();
  }, [push]);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_360px]">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your classes</h1>
          <Link
            to="/generate"
            className="rounded-xl bg-coral-500 px-4 py-2 text-white hover:bg-coral-400 transition"
          >
            Generate quiz
          </Link>
        </div>

        {loading ? (
          <Skeleton rows={3} />
        ) : classes.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {classes.map((c) => (
              <Link
                key={c.id}
                to={`/generate?class=${c.id}`}
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4 hover:border-stone-700"
              >
                <h3 className="font-medium">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-stone-400">
                  {c.description || "No description"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>

      <aside className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
        <h2 className="mb-3 font-medium">Recent results</h2>
        <div className="space-y-2">
          {attempts.map((a) => (
            <Link key={a.id} to={`/quiz/${a.quizzes.id}`} className="block rounded-xl border border-stone-800 p-3 hover:border-stone-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-300">{new Date(a.created_at).toLocaleString()}</span>
                <span className="rounded-lg bg-stone-800 px-2 py-1 text-sm">
                  {getLetterGradeFromFraction(a.score)} · {Math.round(a.score * 100)}%
                </span>
              </div>
            </Link>
          ))}
          {!attempts.length && <p className="text-sm text-stone-400">No attempts yet.</p>}
        </div>
      </aside>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-8 text-center">
      <h3 className="text-lg font-medium">Create your first class</h3>
      <p className="mt-1 text-sm text-stone-400">Start by generating a quiz from your notes.</p>
      <Link to="/generate" className="mt-4 inline-block rounded-xl bg-coral-500 px-4 py-2 text-white hover:bg-coral-400 transition">
        Generate quiz
      </Link>
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
          <div className="h-4 w-1/3 rounded bg-stone-700" />
          <div className="mt-2 h-3 w-2/3 rounded bg-stone-800" />
        </div>
      ))}
    </div>
  );
}
