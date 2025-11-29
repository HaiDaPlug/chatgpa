// Purpose: Quiz taking page - fetch questions, collect answers, submit for grading
// Refactored: One-question-at-a-time pagination UI with progress tracking
// Connects to: /api/v1/ai?action=grade, quiz_attempts table, Results page

import { useEffect, useState } from "react";
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

// ---- UI Components ----

function QuizHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className="sticky top-0 z-50 bg-[var(--bg)] bg-opacity-80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
      <div className="max-w-[900px] mx-auto px-6 md:px-8 py-4 md:py-6 flex justify-between items-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-[var(--text-muted)] text-sm font-medium px-2 py-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all duration-[var(--motion-duration-fast)]"
          aria-label="Go back to results"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <div className="text-[var(--text)] text-[15px] font-semibold tracking-tight">
          {title}
        </div>
        <div className="w-[80px]" aria-hidden="true">{/* Spacer for symmetry */}</div>
      </div>
    </header>
  );
}

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="text-center mb-8 animate-slideDown" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
      <span
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] bg-[var(--surface)] px-4 py-1.5 rounded-full border border-[var(--border-subtle)]"
        aria-live="polite"
        aria-label={`Question ${current} of ${total}`}
      >
        <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse" aria-hidden="true"></span>
        Question {current} of {total}
      </span>
    </div>
  );
}

function QuestionCard({ question }: { question: string }) {
  return (
    <section
      className="bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-8 md:p-12 mb-8 shadow-lg relative overflow-hidden animate-slideUp"
      style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
    >
      {/* Top accent border */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] opacity-60" aria-hidden="true"></div>

      <h1 className="text-[26px] md:text-[28px] font-semibold text-[var(--text)] text-center leading-[1.4] tracking-tight">
        {question}
      </h1>
    </section>
  );
}

function McqOptions({
  options,
  value,
  onChange,
  disabled
}: {
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-4 mb-8 animate-slideUp" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
      {options.map((opt) => {
        const isSelected = value === opt;
        return (
          <label
            key={opt}
            className={`
              flex items-center gap-4 p-5 md:p-6 rounded-xl border-[1.5px] cursor-pointer transition-all duration-[var(--motion-duration-slow)]
              ${isSelected
                ? 'bg-[var(--accent-soft)] border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]'
                : 'bg-[var(--surface)] border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-sm'
              }
              ${disabled ? 'opacity-60 pointer-events-none' : ''}
            `}
          >
            {/* Radio button visual */}
            <div
              className={`
                w-[22px] h-[22px] rounded-full border-2 flex-shrink-0 transition-all duration-[var(--motion-duration-normal)]
                ${isSelected
                  ? 'border-[var(--accent)] bg-[var(--accent)] shadow-[inset_0_0_0_4px_var(--surface)]'
                  : 'border-[var(--text-soft)]'
                }
              `}
              aria-hidden="true"
            ></div>

            {/* Hidden native radio for accessibility */}
            <input
              type="radio"
              name="mcq-option"
              value={opt}
              checked={isSelected}
              onChange={() => onChange(opt)}
              disabled={disabled}
              className="sr-only"
            />

            <span className="text-base font-medium text-[var(--text)] flex-1">
              {opt}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function TypingAnswer({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const charCount = value.length;

  return (
    <div className="relative mb-8 animate-slideUp" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
      <textarea
        className="w-full min-h-[180px] bg-[var(--surface)] text-[var(--text)] border-[1.5px] border-[var(--border-strong)] rounded-xl px-4 md:px-6 py-4 md:py-5 font-[inherit] text-base leading-[1.6] resize-vertical transition-all duration-[var(--motion-duration-normal)] focus:outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-raised)] focus:ring-4 focus:ring-[var(--accent-soft)] placeholder:text-[var(--text-soft)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer here and explain your reasoning..."
      />
      <div
        className="absolute bottom-3 right-4 text-xs text-[var(--text-soft)] pointer-events-none"
        aria-live="polite"
        aria-label={`${charCount} characters entered`}
      >
        {charCount} characters
      </div>
    </div>
  );
}

function QuizFooter({
  onPrevious,
  onNext,
  onSubmit,
  canGoPrevious,
  isLastQuestion,
  submitting
}: {
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canGoPrevious: boolean;
  isLastQuestion: boolean;
  submitting: boolean;
}) {
  return (
    <footer className="flex justify-between items-center gap-4 pt-8 animate-slideUp" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
      {canGoPrevious ? (
        <button
          onClick={onPrevious}
          disabled={submitting}
          className="btn secondary inline-flex items-center gap-2"
          aria-label="Go to previous question"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Previous
        </button>
      ) : (
        <div></div> // Empty div for flex spacing
      )}

      {isLastQuestion ? (
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="btn primary inline-flex items-center gap-2"
          aria-label="Submit quiz for grading"
        >
          {submitting ? 'Submitting…' : 'Submit Quiz'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={submitting}
          className="btn primary inline-flex items-center gap-2"
          aria-label="Go to next question"
        >
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      )}
    </footer>
  );
}

function BottomProgressBar({ percent }: { percent: number }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-1 bg-[var(--surface)] z-50" aria-hidden="true">
      <div
        className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-all duration-[600ms] ease-[var(--motion-ease)] relative overflow-hidden"
        style={{ width: `${percent}%` }}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
      </div>
    </div>
  );
}

// ---- Main Component ----

export default function QuizPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const { push } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({}); // Single source of truth for all answers
  const [currentIndex, setCurrentIndex] = useState(0); // Track which question is displayed (0-based)

  // Fetch quiz (PRESERVED - lines 132-163)
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

  // Computed values
  const currentQuestion = quiz?.questions[currentIndex];
  const totalQuestions = quiz?.questions.length ?? 0;
  const canGoPrevious = currentIndex > 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  // Progress: avoid off-by-one (Question 1 of 10 = 10%, not 0%)
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  // Answer persistence: answers state is single source of truth, never reset on navigation
  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  // Navigation handlers
  function goToPrevious() {
    if (canGoPrevious) {
      setCurrentIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goToNext() {
    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Submit handler (PRESERVED EXACTLY - lines 174-220)
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
      const res = await fetch("/api/v1/ai?action=grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quiz_id: quizId,
          responses: answers, // answers shape unchanged: Record<string, string>
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

      // Success - API created the attempt (gateway wraps as {ok, data, request_id})
      const result = payload.data || payload;
      push({ kind: "success", text: result?.summary || "Graded!" });
      navigate("/results");
    } catch (error) {
      console.error("SUBMIT_ERROR", { error });
      push({ kind: "error", text: "Network error. Please try again." });
      setSubmitting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg p-6 text-center text-[var(--text-muted)]">
            Loading quiz…
          </div>
        </div>
      </PageShell>
    );
  }

  // Not found state
  if (!quiz || quiz.questions.length === 0) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg p-6 text-center text-[var(--text-muted)]">
            Quiz not found.
          </div>
        </div>
      </PageShell>
    );
  }

  // Ensure currentIndex is valid (defensive)
  if (!currentQuestion) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg p-6 text-center text-[var(--text-danger)]">
            Invalid question index.
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="min-h-screen flex flex-col">
        <QuizHeader
          onBack={() => navigate("/results")}
          title={`Quiz · ${quizId?.slice(0, 8) || 'Unknown'}`}
        />

        <main className="flex-1 w-full max-w-[840px] mx-auto px-6 md:px-8 py-8 md:py-12 flex flex-col justify-center min-h-[70vh]">
          <ProgressIndicator
            current={currentIndex + 1} // Display 1-indexed (Question 1 of 10, not 0 of 10)
            total={totalQuestions}
          />

          <QuestionCard question={currentQuestion.prompt} />

          {/* Answer section - switches based on question type */}
          {currentQuestion.type === "mcq" ? (
            <McqOptions
              options={(currentQuestion as MCQ).options}
              value={answers[currentQuestion.id]}
              onChange={(v) => setAnswer(currentQuestion.id, v)}
              disabled={submitting}
            />
          ) : (
            <TypingAnswer
              value={answers[currentQuestion.id] ?? ""}
              onChange={(v) => setAnswer(currentQuestion.id, v)}
            />
          )}

          <QuizFooter
            onPrevious={goToPrevious}
            onNext={goToNext}
            onSubmit={handleSubmit}
            canGoPrevious={canGoPrevious}
            isLastQuestion={isLastQuestion}
            submitting={submitting}
          />
        </main>

        <BottomProgressBar percent={progressPercent} />
      </div>

      <style>{`
        /* Animations - respect prefers-reduced-motion */
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.5s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.6s ease-out;
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .animate-slideDown,
          .animate-slideUp,
          .animate-pulse,
          .animate-shimmer {
            animation: none !important;
          }

          * {
            transition-duration: 0.01ms !important;
          }
        }

        /* Also respect data-motion="reduced" attribute */
        :root[data-motion="reduced"] .animate-slideDown,
        :root[data-motion="reduced"] .animate-slideUp,
        :root[data-motion="reduced"] .animate-pulse,
        :root[data-motion="reduced"] .animate-shimmer {
          animation: none !important;
        }

        :root[data-motion="reduced"] * {
          transition-duration: 0.01ms !important;
        }
      `}</style>
    </PageShell>
  );
}
