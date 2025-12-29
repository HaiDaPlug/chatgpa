// Purpose: Quiz taking page - fetch questions, collect answers, submit for grading
// Refactored: One-question-at-a-time pagination UI with progress tracking
// Connects to: /api/v1/ai?action=grade, quiz_attempts table, Results page

import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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

// ---- localStorage Persistence Types (Session 29) ----
interface QuizProgressData {
  version: number;
  quizId: string;
  attemptId?: string;
  questionIds: string[];
  answers: Record<string, string>;
  currentIndex: number;
  updatedAt: string;
}

const QUIZ_PROGRESS_VERSION = 1;
const getQuizProgressKey = (quizId: string, attemptId?: string) => {
  if (attemptId) return `quiz_progress_attempt_${attemptId}`;
  return `quiz_progress_quiz_${quizId}`;
};

// Helper: Check if value is truly missing (not just falsy)
const isMissing = (v: unknown) => v === undefined || v === null;

// Helper: Read localStorage snapshot explicitly (for deterministic merging)
function readLocalSnapshot(storageKey: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.answers ?? null;
  } catch {
    return null;
  }
}

// P2: Format timestamp for autosave indicator
function formatRelativeTime(date: Date): string {
  try {
    const now = Date.now();
    const diff = now - date.getTime();

    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch (err) {
    console.warn('Failed to format timestamp', err);
    return '';
  }
}

// ---- UI Components ----

function QuizHeader({
  onBack,
  title,
  shuffleEnabled,
  onShuffleToggle,
}: {
  onBack: () => void;
  title: string;
  shuffleEnabled: boolean;
  onShuffleToggle: (enabled: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-50 bg-[var(--bg)] bg-opacity-80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
      <div className="max-w-[900px] mx-auto px-6 md:px-8 py-4 md:py-6 flex justify-between items-center gap-4">
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
        <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={shuffleEnabled}
            onChange={(e) => onShuffleToggle(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--border-strong)] bg-[var(--surface)] checked:bg-[var(--accent)] checked:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-colors"
          />
          <span>Shuffle</span>
        </label>
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
  submitting,
  lastSavedAt,
}: {
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canGoPrevious: boolean;
  isLastQuestion: boolean;
  submitting: boolean;
  lastSavedAt?: Date | null;
}) {
  return (
    <footer className="pt-8 animate-slideUp" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
      {/* P2: Autosave indicator */}
      {lastSavedAt && (
        <div
          className="text-xs text-center mb-3"
          style={{ color: 'var(--text-soft)' }}
        >
          ✓ Saved {formatRelativeTime(lastSavedAt)}
        </div>
      )}

      <div className="flex justify-between items-center gap-4">
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
      </div>
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

// ---- localStorage Persistence Helpers (Session 29) ----

/**
 * Load and validate quiz progress from localStorage
 * Returns null if data is invalid, corrupted, or stale
 */
function loadQuizProgress(
  storageKey: string,
  quizId: string,
  questions: (MCQ | ShortQ)[]
): QuizProgressData | null {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored);

    // Validate schema
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (typeof parsed.version !== 'number') {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (typeof parsed.quizId !== 'string') {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (!Array.isArray(parsed.questionIds)) {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (!parsed.answers || typeof parsed.answers !== 'object') {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (typeof parsed.currentIndex !== 'number') {
      localStorage.removeItem(storageKey);
      return null;
    }
    if (typeof parsed.updatedAt !== 'string') {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Validate version
    if (parsed.version !== QUIZ_PROGRESS_VERSION) {
      if (import.meta.env.DEV) {
        console.warn('QUIZ_STORAGE_VERSION_MISMATCH', {
          expected: QUIZ_PROGRESS_VERSION,
          actual: parsed.version,
        });
      }
      localStorage.removeItem(storageKey);
      return null;
    }

    // Validate quizId matches
    if (parsed.quizId !== quizId) {
      if (import.meta.env.DEV) {
        console.warn('QUIZ_STORAGE_QUIZ_ID_MISMATCH', {
          expected: quizId,
          actual: parsed.quizId,
        });
      }
      localStorage.removeItem(storageKey);
      return null;
    }

    // Defensive check: if no questions, treat as invalid
    if (questions.length === 0) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Check questionIds match EXACTLY (same IDs in same order)
    // This prevents currentIndex from pointing to wrong question if backend reorders
    const currentQuestionIds = questions.map((q) => q.id);

    // Length check first (fast fail)
    if (parsed.questionIds.length !== currentQuestionIds.length) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Check exact array equality (same order)
    const hasStaleData = parsed.questionIds.some(
      (id: string, idx: number) => id !== currentQuestionIds[idx]
    );
    if (hasStaleData) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Clamp currentIndex to valid range [0..questions.length-1]
    if (parsed.currentIndex < 0) {
      parsed.currentIndex = 0;
    } else if (parsed.currentIndex >= questions.length) {
      parsed.currentIndex = questions.length - 1;
    }

    return parsed as QuizProgressData;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('QUIZ_STORAGE_LOAD_ERROR', { storageKey, error });
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    return null;
  }
}

/**
 * Save quiz progress to localStorage
 * Silent failure on errors (non-critical feature)
 */
function saveQuizProgress(
  storageKey: string,
  quizId: string,
  attemptId: string | undefined,
  questionIds: string[],
  answers: Record<string, string>,
  currentIndex: number
): void {
  try {
    const data: QuizProgressData = {
      version: QUIZ_PROGRESS_VERSION,
      quizId,
      attemptId,
      questionIds,
      answers,
      currentIndex,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('QUIZ_STORAGE_SAVE_ERROR', { storageKey, error });
    }
    // Fail silently - quiz still works without persistence
  }
}

/**
 * Clear quiz progress from localStorage
 * Silent failure on errors
 */
function clearQuizProgress(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('QUIZ_STORAGE_CLEAR_ERROR', { storageKey, error });
    }
  }
}

// ---- Main Component ----

export default function QuizPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const { push } = useToast();
  const navigate = useNavigate();

  // localStorage persistence (Session 29)
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attempt') || undefined;

  // Hydration guards
  const didHydrateRef = useRef(false);   // Track if we've already restored from localStorage
  const isHydratingRef = useRef(false);  // Track if we're currently hydrating
  const hasEverSavedRef = useRef(false); // Track if we've saved at least once

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({}); // Single source of truth for all answers
  const [currentIndex, setCurrentIndex] = useState(0); // Track which question is displayed (0-based)

  // Server-side autosave state (Session 31)
  const [autosaveVersion, setAutosaveVersion] = useState(0);
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRetryRef = useRef(false);
  const lastAutosavedAnswersRef = useRef<Record<string, string>>({});

  // P2: Last saved timestamp for autosave indicator
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // P1 Bonus: Shuffle toggle (stable per attempt)
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<string[] | null>(null);

  // P1: Practice mode filter (reads scoped localStorage)
  const practiceFilter = useMemo(() => {
    const isPracticeMode = searchParams.get('practice') === 'true';
    if (!isPracticeMode) return null;
    if (!attemptId) return null;

    // Read from scoped key: practice_filter:{attemptId}
    const stored = localStorage.getItem(`practice_filter:${attemptId}`);
    if (!stored) return null;

    try {
      const filter = JSON.parse(stored);
      // Validate: must match current quiz and be recent (< 5 min)
      if (filter.quiz_id !== quizId) return null;
      if (Date.now() - filter.created_at > 5 * 60 * 1000) return null;

      // CLEANUP: Remove from localStorage after consuming (prevents replays)
      localStorage.removeItem(`practice_filter:${attemptId}`);

      return filter.question_ids as string[];
    } catch (err) {
      console.warn('Failed to parse practice filter', err);
      return null;
    }
  }, [quizId, searchParams, attemptId]);

  // P1: Filter questions if in practice mode (with fallback) + shuffle if enabled
  const displayQuestions = useMemo(() => {
    if (!quiz?.questions) return [];

    // Step 1: Apply practice filter if active
    let questions = practiceFilter
      ? quiz.questions.filter(q => practiceFilter.includes(q.id))
      : quiz.questions;

    // BULLETPROOF: If filter results in 0 questions, fall back to full quiz
    if (practiceFilter && questions.length === 0) {
      console.warn('Practice filter resulted in 0 questions, using full quiz');
      push({ kind: 'info', text: 'No questions matched filter. Showing full quiz.' });
      questions = quiz.questions;
    }

    // Step 2: Apply shuffle if enabled (stable order per attempt)
    if (shuffleEnabled) {
      // If we don't have a stable order yet, create one
      if (!shuffledOrder) {
        const questionIds = questions.map(q => q.id);
        const shuffled = [...questionIds];  // Clone

        // Fisher-Yates shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        setShuffledOrder(shuffled);  // Store stable order
        return questions;  // First render returns unshuffled (will re-render with shuffled)
      }

      // Apply stable shuffled order
      const questionMap = new Map(questions.map(q => [q.id, q]));
      return shuffledOrder.map(id => questionMap.get(id)).filter(Boolean) as typeof questions;
    }

    return questions;
  }, [quiz?.questions, practiceFilter, push, shuffleEnabled, shuffledOrder]);

  // Reset shuffled order when shuffle is disabled
  useEffect(() => {
    if (!shuffleEnabled) {
      setShuffledOrder(null);
    }
  }, [shuffleEnabled]);

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

      // Try to restore progress from localStorage (only once per page load)
      if (!didHydrateRef.current) {
        // Use fetched data.id as source of truth (not route quizId)
        const key = getQuizProgressKey(data.id, attemptId);

        // Assert route quizId matches fetched id in DEV
        if (import.meta.env.DEV && quizId !== data.id) {
          console.warn('QUIZ_STORAGE_ID_MISMATCH', { routeId: quizId, fetchedId: data.id });
        }

        const stored = loadQuizProgress(key, data.id, qs);
        if (stored) {
          isHydratingRef.current = true; // Keep true through first save-effect pass
          setAnswers(stored.answers);
          setCurrentIndex(stored.currentIndex);
          if (import.meta.env.DEV) {
            console.debug('QUIZ_PROGRESS_RESTORED', {
              quiz_id: data.id,
              attempt_id: stored.attemptId,
              restored_answer_count: Object.keys(stored.answers).length,
              restored_index: stored.currentIndex,
            });
          }
          // Don't flip isHydratingRef to false here - let save effect handle it
        }

        // Cleanup: if using attempt-key, remove orphaned quiz-key (polish)
        if (attemptId && quizId) {
          try {
            const orphanedKey = `quiz_progress_quiz_${quizId}`;
            localStorage.removeItem(orphanedKey);
          } catch {}
        }

        didHydrateRef.current = true;
      }

      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [quizId, navigate, push, attemptId]);

  // B1: Load attempt data from server when attemptId exists (Session 31)
  useEffect(() => {
    if (!attemptId || !quiz) return; // Wait for quiz to load first

    async function loadAttempt() {
      if (!quiz) return; // TypeScript null guard

      try {
        const { data, error } = await supabase
          .from('quiz_attempts')
          .select('responses, autosave_version, quiz_id')
          .eq('id', attemptId)
          .eq('status', 'in_progress')
          .single();

        if (error) throw error;

        // Verify attempt belongs to this quiz (use resolved quiz.id, not route param)
        if (data.quiz_id !== quiz.id) {
          throw new Error('Attempt does not belong to this quiz');
        }

        // Explicitly read localStorage snapshot (deterministic)
        const storageKey = getQuizProgressKey(quiz.id, attemptId);
        const localSnapshot = readLocalSnapshot(storageKey);

        // Merge server baseline + localStorage overlay
        const serverAnswers = data.responses || {};
        const localAnswers = localSnapshot || {};

        // Server as baseline, overlay local answers if server doesn't have them
        const mergedAnswers = { ...serverAnswers };
        for (const [qid, localAnswer] of Object.entries(localAnswers)) {
          // Only treat undefined/null as "missing" (not falsy like "", 0, false)
          if (isMissing(mergedAnswers[qid]) && !isMissing(localAnswer)) {
            mergedAnswers[qid] = localAnswer as string;
          }
        }

        // Update state
        setAnswers(mergedAnswers);
        setAutosaveVersion(data.autosave_version || 0);

        // Calculate currentIndex (first unanswered question in displayQuestions)
        const firstUnanswered = displayQuestions.findIndex(q => isMissing(mergedAnswers[q.id]));
        setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);

      } catch (err) {
        console.error('Failed to load attempt:', err);
        push({ kind: 'error', text: 'Failed to load quiz progress' });
      }
    }

    loadAttempt();
  }, [attemptId, quiz, push]);

  // B2: Ensure in-progress attempt exists (Session 31)
  useEffect(() => {
    if (attemptId || !quiz) return; // Skip if attemptId already exists or quiz not loaded

    async function ensureAttempt() {
      if (!quiz) return; // TypeScript null guard

      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token) return;

        const res = await fetch(`/api/v1/attempts?action=start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ quiz_id: quiz.id })
        });

        if (!res.ok) {
          const { message } = await res.json();
          throw new Error(message);
        }

        const { attempt_id } = await res.json();

        // Update URL with resolved quiz ID + attempt ID
        const newUrl = `/quiz/${quiz.id}?attempt=${attempt_id}`;
        navigate(newUrl, { replace: true });

      } catch (err) {
        console.error('Failed to create attempt:', err);
        push({ kind: 'error', text: 'Failed to start quiz attempt' });
      }
    }

    ensureAttempt();
  }, [attemptId, quiz, navigate, push]);

  // Compute resolved storage key from fetched quiz.id (source of truth)
  const resolvedKey = quiz ? getQuizProgressKey(quiz.id, attemptId) : null;

  // Save progress to localStorage whenever answers or currentIndex change
  useEffect(() => {
    if (!quiz || !resolvedKey) return;

    // Skip first save-effect pass after hydration (state updates haven't applied yet)
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }

    // Don't save empty state on FIRST render only (prevents perpetual skip if user deletes all answers)
    if (!hasEverSavedRef.current && Object.keys(answers).length === 0 && currentIndex === 0) {
      return;
    }

    const questionIds = quiz.questions.map((q) => q.id);
    saveQuizProgress(resolvedKey, quiz.id, attemptId, questionIds, answers, currentIndex);
    hasEverSavedRef.current = true; // Mark that we've saved at least once
  }, [answers, currentIndex, quiz, attemptId, resolvedKey]);

  // B3: Server-side autosave with conflict resolution (Session 31)
  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return;

    // Clear previous timeout
    if (autosaveTimeout.current) {
      clearTimeout(autosaveTimeout.current);
    }

    // Debounce: wait 800ms after last change
    autosaveTimeout.current = setTimeout(async () => {
      try {
        // Only autosave if answers actually changed (prevent retry loops)
        const answersChanged = JSON.stringify(answers) !== JSON.stringify(lastAutosavedAnswersRef.current);
        if (!answersChanged) return;

        // Get fresh session
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token) return;

        const res = await fetch(`/api/v1/attempts?action=autosave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            attempt_id: attemptId,
            responses: answers,
            autosave_version: autosaveVersion
          })
        });

        if (!res.ok) {
          // Handle conflict (409) - retry once per conflict event
          if (res.status === 409 && !autosaveRetryRef.current) {
            // Set retry flag BEFORE refetch (prevent loop)
            autosaveRetryRef.current = true;

            const { data } = await supabase
              .from('quiz_attempts')
              .select('responses, autosave_version')
              .eq('id', attemptId)
              .single();

            if (data) {
              // Merge server data with local answers (local overlay)
              const merged = { ...data.responses, ...answers };

              // Only update if merged actually differs
              const mergedChanged = JSON.stringify(merged) !== JSON.stringify(answers);
              if (mergedChanged) {
                setAnswers(merged);
                setAutosaveVersion(data.autosave_version);
                // Retry autosave will trigger via answers update
              } else {
                // Answers are the same, just update version
                setAutosaveVersion(data.autosave_version);
                autosaveRetryRef.current = false;
              }
            }

            return; // Don't reset retry flag yet - let next autosave handle it
          }

          throw new Error('Autosave failed');
        }

        const { autosave_version } = await res.json();
        setAutosaveVersion(autosave_version);
        lastAutosavedAnswersRef.current = answers; // Track last successful save
        autosaveRetryRef.current = false; // Reset retry flag after success
        setLastSavedAt(new Date()); // P2: Update last saved timestamp

        // Optional: Show subtle indicator (non-intrusive)
        if (import.meta.env.DEV) {
          console.log('Autosaved to server:', autosave_version);
        }

      } catch (err) {
        console.error('Server autosave failed (non-blocking):', err);
        autosaveRetryRef.current = false;
        // Don't show toast - this is non-blocking
        // localStorage is still the safety net
      }
    }, 800);

    return () => {
      if (autosaveTimeout.current) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, [answers, attemptId, autosaveVersion]);

  // Computed values (use displayQuestions for UI display)
  const currentQuestion = displayQuestions[currentIndex];
  const totalQuestions = displayQuestions.length;
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

      // Submit to grading API (updates existing attempt when attempt_id provided)
      const res = await fetch("/api/v1/ai?action=grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quiz_id: quizId,
          attempt_id: attemptId, // Pass attempt_id to update existing attempt (Session 31)
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

      // Clear localStorage after successful submission
      const key = getQuizProgressKey(quiz.id, attemptId);
      if (key) {
        clearQuizProgress(key);
      }

      // P0: Direct to attempt detail for immediate feedback (bulletproofed with fallback)
      if (attemptId) {
        navigate(`/attempts/${attemptId}`);
        push({ kind: "success", text: "Saved to Results" });
      } else {
        // Fallback if attemptId is missing (shouldn't happen but prevents blank route crash)
        navigate("/results");
        push({ kind: "success", text: "Saved. Open latest attempt." });
      }
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
  if (!quiz || displayQuestions.length === 0) {
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
          shuffleEnabled={shuffleEnabled}
          onShuffleToggle={setShuffleEnabled}
        />

        <main className="flex-1 w-full max-w-[840px] mx-auto px-6 md:px-8 py-8 md:py-12 flex flex-col justify-center min-h-[70vh]">
          {practiceFilter && (
            <div
              className="mb-6 px-4 py-3 rounded-lg text-sm text-center"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--text)',
                border: '1px solid var(--accent)',
              }}
            >
              📝 Practice Mode: Reviewing {displayQuestions.length} incorrect question{displayQuestions.length !== 1 ? 's' : ''}
            </div>
          )}

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
            lastSavedAt={lastSavedAt}
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
