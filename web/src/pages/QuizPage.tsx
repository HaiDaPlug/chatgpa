// Purpose: Quiz taking page - fetch questions, collect answers, submit for grading
// Connects to: /api/grade, quiz_attempts table, Results page

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { PageShell } from "@/components/PageShell";

// ---- Types (align with our zod schema: mcq | short) ----
type MCQ = {
  id: string;
  type: "mcq";
  prompt: string;
  options: string[];
  answer?: string; // server may include; we won't show it
};

type ShortQ = {
  id: string;
  type: "short";
  prompt: string;
  answer?: string; // server may include; we won't show it
};

type QuizRow = {
  id: string;
  questions: (MCQ | ShortQ)[];
  class_id: string;
};

type AnswersMap = Record<string, string>; // questionId -> user answer

// ---- Small UI bits (token-only styling) ----
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface bdr radius p-4 mb-4">
      <div className="text-sm text-muted mb-2">{title}</div>
      {children}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  kind = "primary",
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "ghost";
  type?: "button" | "submit";
}) {
  const cls = kind === "primary" ? "btn primary" : "btn ghost";
  return (
    <button className={cls} onClick={onClick} disabled={disabled} type={type ?? "button"}>
      {children}
    </button>
  );
}

// ---- Question renderers ----
function MCQQuestion({
  q,
  value,
  onChange,
}: {
  q: MCQ;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2">{q.prompt}</div>
      <div className="grid gap-2">
        {q.options.map((opt) => (
          <label key={opt} className="surface-2 bdr radius p-2 cursor-pointer">
            <input
              className="mr-2"
              type="radio"
              name={q.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function ShortQuestion({
  q,
  value,
  onChange,
}: {
  q: ShortQ;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2">{q.prompt}</div>
      <textarea
        rows={3}
        className="w-full surface-2 bdr radius p-2"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer…"
      />
    </div>
  );
}

export default function QuizPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const { push } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({});

  // Fetch quiz
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!quizId) {
        push({ kind: "error", text: "Missing quiz id." });
        navigate("/results");
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, class_id, questions")
        .eq("id", quizId)
        .single();

      if (!alive) return;

      if (error || !data) {
        push({ kind: "error", text: "Could not load quiz." });
        setLoading(false);
        return;
      }

      // Defensive parse: ensure array of objects
      const qs = Array.isArray(data.questions) ? (data.questions as (MCQ | ShortQ)[]) : [];
      setQuiz({ id: data.id, class_id: data.class_id, questions: qs });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [quizId, navigate, push]);

  const unanswered = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.filter((q) => !answers[q.id]?.trim()).length;
  }, [quiz, answers]);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit() {
    if (!quiz || !quizId) return;
    setSubmitting(true);

    try {
      // Get auth token
      const session = (await supabase.auth.getSession()).data.session;
      const accessToken = session?.access_token;
      if (!accessToken) {
        push({ kind: "error", text: "You are signed out. Please sign in again." });
        setSubmitting(false);
        return;
      }

      // Submit to grading API (creates attempt via RLS)
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quiz_id: quizId,
          responses: answers,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        const msg = payload?.message || "Grading failed.";
        console.error("GRADE_ERROR", { status: res.status, payload });
        push({ kind: "error", text: msg });
        setSubmitting(false);
        return;
      }

      // Success - API created the attempt
      push({ kind: "success", text: payload?.summary || "Graded!" });
      navigate("/results");
    } catch (error) {
      console.error("SUBMIT_ERROR", { error });
      push({ kind: "error", text: "Network error. Please try again." });
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="surface bdr radius p-4">Loading quiz…</div>
      </PageShell>
    );
  }

  if (!quiz) {
    return (
      <PageShell>
        <div className="surface bdr radius p-4">Quiz not found.</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <form
        className="max-w-3xl mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (!submitting) handleSubmit();
        }}
      >
        <Section title="Quiz">
          <div className="text-xl mb-1">Answer the questions</div>
          <div className="text-muted">
            {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""} ·{" "}
            {unanswered} unanswered
          </div>
        </Section>

        <Section title="Questions">
          {quiz.questions.map((q) => {
            if (q.type === "mcq") {
              return (
                <MCQQuestion
                  key={q.id}
                  q={q as MCQ}
                  value={answers[q.id]}
                  onChange={(v) => setAnswer(q.id, v)}
                />
              );
            }
            return (
              <ShortQuestion
                key={q.id}
                q={q as ShortQ}
                value={answers[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />
            );
          })}
        </Section>

        <div className="flex items-center gap-4">
          <Btn type="submit" kind="primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit for grading"}
          </Btn>
          <Btn kind="ghost" onClick={() => navigate("/results")} disabled={submitting}>
            View results
          </Btn>
        </div>
      </form>
    </PageShell>
  );
}
