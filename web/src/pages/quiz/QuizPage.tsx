import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

type Quiz = { id: string; questions: any[] };
type Answer = { questionId: string; answer: string };

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { push } = useToast();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, questions")
        .eq("id", id)
        .single();
      if (error || !data) {
        push({ type: "error", message: "Quiz not found." });
        nav("/dashboard", { replace: true });
        return;
      }
      setQuiz({ id: data.id, questions: data.questions ?? [] });
      setLoading(false);
    })();
  }, [id, nav, push]);

  const canSubmit = useMemo(() => {
    if (!quiz) return false;
    const ids = (quiz.questions ?? []).map((q: any) => q.id).filter(Boolean);
    return ids.length > 0 && ids.every((qid: string) => (answers[qid] ?? "").trim().length > 0);
  }, [quiz, answers]);

  function updateAnswer(qid: string, val: string) {
    setAnswers((s) => ({ ...s, [qid]: val }));
  }

  async function onSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        push({ type: "error", message: "Please log in to submit" });
        setSubmitting(false);
        return;
      }
      const token = session.access_token;
      const payload = {
        quiz_id: quiz.id,
        answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      };
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        push({ type: "error", message: json?.message || json?.code || "Failed to grade." });
        return;
      }
      push({ type: "success", message: `Scored ${Math.round(json.score)}% (${json.letter})` });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton />;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Quiz</h1>
        <p className="text-sm text-stone-400">Answer all questions, then submit for grading.</p>
      </header>

      {!quiz?.questions?.length ? (
        <div className="rounded-2xl border border-stone-800 bg-stone-900/60 p-6">
          <p className="text-stone-300">This quiz has no questions.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {quiz.questions.map((q: any, idx: number) => (
            <div key={q.id ?? idx} className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
              <div className="mb-2 text-sm text-stone-400">Question {idx + 1}</div>
              <div className="mb-3 font-medium">{q.prompt ?? q.question ?? "Untitled question"}</div>

              {Array.isArray(q.options) && q.options.length ? (
                <div className="space-y-2">
                  {q.options.map((opt: string, i: number) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id ?? `q-${idx}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={(e) => updateAnswer(q.id ?? `q-${idx}`, e.target.value)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className="h-28 w-full rounded-xl border border-stone-800 bg-stone-950 p-3 text-stone-100 placeholder-stone-500"
                  placeholder="Type your answer…"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => updateAnswer(q.id ?? `q-${idx}`, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
          className="rounded-xl bg-coral-500 px-4 py-2 font-medium text-white disabled:opacity-60 hover:bg-coral-400 transition"
        >
          {submitting ? "Submitting…" : "Submit for grading"}
        </button>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
          <div className="h-4 w-1/4 rounded bg-stone-800" />
          <div className="mt-2 h-3 w-2/3 rounded bg-stone-900" />
          <div className="mt-2 h-24 w-full rounded bg-stone-900" />
        </div>
      ))}
    </div>
  );
}
