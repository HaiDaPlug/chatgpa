/**
 * AttemptReview - Modern results UI with insights, filters, and expandable feedback
 * Frontend-only, token-first design matching ResultsGemini visual reference
 * Gated behind status === 'submitted'
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import type { BreakdownItem } from '@/lib/grader';

// ===== TYPES =====

interface AttemptReviewProps {
  attempt: {
    id: string;
    quiz_id: string;
    title: string;
    subject: string;
    score: number; // 0-1 decimal
    grading: BreakdownItem[];
    submitted_at?: string;
    started_at: string;
    class_name?: string;
    questions: Question[];
  };
  mode?: 'full' | 'compact';
  onRetake?: () => void;
  onGenerateNew?: () => void;
  onBack?: () => void;
  isRetaking?: boolean;
}

interface Question {
  id: string;
  type: 'mcq' | 'short' | 'long';
  prompt: string;
  options?: string[];
  answer?: string;
}

interface AttemptInsights {
  letterGrade: string;
  percentScore: number;
  correctCount: number;
  totalCount: number;
  timeElapsed: string | null;
  mcqAccuracy: number | null;
  mcqCorrect: number;
  mcqTotal: number;
  shortAccuracy: number | null;
  shortCorrect: number;
  shortTotal: number;
  strongestPattern: string | null;
}

// ===== HELPER FUNCTIONS =====

function calculateLetterGrade(percent: number): string {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
}

function calculateTimeElapsed(startedAt: string, submittedAt?: string): string | null {
  if (!submittedAt) return null;

  try {
    const start = new Date(startedAt);
    const end = new Date(submittedAt);
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) return null; // Invalid time range

    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    if (diffMins === 0) return `${diffSecs}s`;
    return `${diffMins}m ${diffSecs}s`;
  } catch {
    return null;
  }
}

function computeInsights(attempt: AttemptReviewProps['attempt']): AttemptInsights {
  const percentScore = Math.round(attempt.score * 100);
  const letterGrade = calculateLetterGrade(percentScore);

  const correctCount = attempt.grading.filter(item => item.correct).length;
  const totalCount = attempt.grading.length;

  const timeElapsed = calculateTimeElapsed(attempt.started_at, attempt.submitted_at);

  // MCQ-specific metrics (only if type field exists)
  const mcqItems = attempt.grading.filter(item => item.type === 'mcq');
  const mcqCorrect = mcqItems.filter(item => item.correct).length;
  const mcqTotal = mcqItems.length;
  const mcqAccuracy = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : null;

  // Short answer metrics
  const shortItems = attempt.grading.filter(item => item.type === 'short' || item.type === 'long');
  const shortCorrect = shortItems.filter(item => item.correct).length;
  const shortTotal = shortItems.length;
  const shortAccuracy = shortTotal > 0 ? Math.round((shortCorrect / shortTotal) * 100) : null;

  // Pattern detection
  let strongestPattern: string | null = null;
  if (mcqAccuracy !== null && shortAccuracy !== null) {
    if (mcqAccuracy >= 80 && shortAccuracy >= 80) {
      strongestPattern = 'Well-rounded performance';
    } else if (mcqAccuracy > shortAccuracy && mcqAccuracy >= 80) {
      strongestPattern = 'Great on MCQs';
    } else if (shortAccuracy > mcqAccuracy && shortAccuracy >= 80) {
      strongestPattern = 'Strong in typing';
    }
  } else if (mcqAccuracy !== null && mcqAccuracy >= 80) {
    strongestPattern = 'Great on MCQs';
  } else if (shortAccuracy !== null && shortAccuracy >= 80) {
    strongestPattern = 'Strong in typing';
  }

  return {
    letterGrade,
    percentScore,
    correctCount,
    totalCount,
    timeElapsed,
    mcqAccuracy,
    mcqCorrect,
    mcqTotal,
    shortAccuracy,
    shortCorrect,
    shortTotal,
    strongestPattern,
  };
}

// ===== INLINE SUBCOMPONENTS =====

function ScoreHero({
  insights,
  mode,
  onRetake,
  onGenerateNew,
  isRetaking,
}: {
  insights: AttemptInsights;
  mode: 'full' | 'compact';
  onRetake?: () => void;
  onGenerateNew?: () => void;
  isRetaking?: boolean;
}) {
  return (
    <section
      className="rounded-3xl p-8 md:p-12 shadow-sm"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex flex-col md:flex-row gap-10 md:items-center">
        {/* Left: The Grade */}
        <div className="flex-shrink-0 flex flex-col items-center md:items-start text-center md:text-left min-w-[200px]">
          <span
            className="text-sm font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-soft)' }}
          >
            Final Grade
          </span>

          {/* Grade Badge with decorative underline */}
          <div className="relative inline-block">
            <span
              className="font-serif text-8xl font-bold tracking-tighter"
              style={{ color: 'var(--text)', fontFamily: 'Georgia, serif' }}
            >
              {insights.letterGrade}
            </span>
            {/* Decorative underline */}
            <div
              className="absolute -bottom-2 left-0 w-full h-3 rounded-full -z-10"
              style={{
                background: 'var(--accent-soft)',
                transform: 'rotate(-1deg)',
              }}
            />
          </div>

          <span
            className="text-2xl font-medium mt-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {insights.percentScore}%
          </span>
        </div>

        {/* Right: Stats & Actions */}
        <div className="flex-grow w-full space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Accuracy */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-3 mb-1" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Accuracy</span>
              </div>
              <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
                {insights.correctCount}{' '}
                <span className="text-lg" style={{ color: 'var(--text-soft)' }}>
                  / {insights.totalCount}
                </span>
              </div>
            </div>

            {/* Time */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-3 mb-1" style={{ color: 'var(--text-muted)' }}>
                <Clock className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Time</span>
              </div>
              <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
                {insights.timeElapsed || '—'}
              </div>
            </div>
          </div>

          {/* Actions (only in full mode) */}
          {mode === 'full' && (onRetake || onGenerateNew) && (
            <div className="flex flex-col sm:flex-row gap-4">
              {onRetake && (
                <button
                  onClick={onRetake}
                  disabled={isRetaking}
                  className="flex-1 h-14 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <RotateCcw className="w-5 h-5" />
                  {isRetaking ? 'Loading...' : 'Retake Quiz'}
                </button>
              )}
              {onGenerateNew && (
                <button
                  onClick={onGenerateNew}
                  className="flex-1 h-14 rounded-xl font-semibold text-lg transition-all active:scale-[0.98]"
                  style={{
                    background: 'var(--surface-raised)',
                    color: 'var(--text)',
                    border: '2px solid var(--border-strong)',
                  }}
                >
                  Generate New Quiz
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function InsightTile({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-3 mb-2" style={{ color: 'var(--text-muted)' }}>
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {subtext}
      </div>
    </div>
  );
}

function InsightStrip({ insights }: { insights: AttemptInsights }) {
  const tiles = [];

  // Tile 1: MCQ accuracy (if available)
  if (insights.mcqAccuracy !== null && insights.mcqTotal > 0) {
    tiles.push(
      <InsightTile
        key="mcq"
        icon={<Target className="w-5 h-5" />}
        label="MCQ Accuracy"
        value={`${insights.mcqAccuracy}%`}
        subtext={`${insights.mcqCorrect} of ${insights.mcqTotal} correct`}
      />
    );
  }

  // Tile 2: Short answer accuracy (if available)
  if (insights.shortAccuracy !== null && insights.shortTotal > 0) {
    tiles.push(
      <InsightTile
        key="short"
        icon={<CheckCircle2 className="w-5 h-5" />}
        label="Typing Accuracy"
        value={`${insights.shortAccuracy}%`}
        subtext={`${insights.shortCorrect} of ${insights.shortTotal} correct`}
      />
    );
  }

  // Tile 3: Pattern or Time
  if (insights.strongestPattern) {
    tiles.push(
      <InsightTile
        key="pattern"
        icon={<TrendingUp className="w-5 h-5" />}
        label="Strength"
        value={insights.strongestPattern}
        subtext="Keep up the momentum"
      />
    );
  } else if (insights.timeElapsed) {
    tiles.push(
      <InsightTile
        key="time"
        icon={<Clock className="w-5 h-5" />}
        label="Completion Time"
        value={insights.timeElapsed}
        subtext="Total time spent"
      />
    );
  }

  // Hide section if no insights
  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tiles}
    </div>
  );
}

function ReviewToolbar({
  filter,
  onFilterChange,
  totalCount,
  incorrectCount,
}: {
  filter: 'all' | 'incorrect';
  onFilterChange: (filter: 'all' | 'incorrect') => void;
  totalCount: number;
  incorrectCount: number;
}) {
  return (
    <div
      className="sticky z-10 py-4"
      style={{
        top: '5rem',
        background: 'var(--bg)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-3">
        <FilterPill
          label="All Questions"
          count={totalCount}
          active={filter === 'all'}
          onClick={() => onFilterChange('all')}
        />
        <FilterPill
          label="Incorrect"
          count={incorrectCount}
          active={filter === 'incorrect'}
          onClick={() => onFilterChange('incorrect')}
        />
      </div>
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2"
      style={{
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? 'var(--accent-text)' : 'var(--text-muted)',
        border: active ? 'none' : '1px solid var(--border-subtle)',
        boxShadow: active ? '0 4px 6px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      <span>{label}</span>
      <span
        className="px-2 py-0.5 rounded-full text-xs font-bold"
        style={{
          background: 'var(--chip-bg)', // P0: Remove rgba, use consistent token (parent has accent bg + shadow)
          color: active ? 'var(--accent-text)' : 'var(--text-soft)',
        }}
      >
        {count}
      </span>
    </button>
  );
}

function AnswerComparison({
  isCorrect,
  userAnswer,
  correctAnswer,
}: {
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer?: string;
}) {
  if (isCorrect) {
    return (
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'rgba(72, 226, 138, 0.08)',
          borderLeft: '4px solid var(--text-success)',
        }}
      >
        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-success)' }} />
        <div>
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-success)' }}>
            Your Answer
          </div>
          <div style={{ color: 'var(--text)' }}>{userAnswer}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
      {/* User answer (incorrect) */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{
          background: 'rgba(239, 68, 68, 0.08)',
          borderLeft: '4px solid var(--text-danger)',
        }}
      >
        <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-danger)' }} />
        <div className="flex-grow">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-danger)' }}>
            Your Answer
          </div>
          <div className="line-through" style={{ color: 'var(--text-muted)' }}>
            {userAnswer}
          </div>
        </div>
      </div>

      {/* Correct answer */}
      {correctAnswer && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{
            background: 'rgba(72, 226, 138, 0.08)',
            borderLeft: '4px solid var(--text-success)',
          }}
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-success)' }} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-success)' }}>
              Correct Answer
            </div>
            <div style={{ color: 'var(--text)' }}>{correctAnswer}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  breakdown,
  index,
  isExpanded,
  onToggle,
}: {
  question: Question;
  breakdown: BreakdownItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const isLongPrompt = question.prompt.length > 150;

  return (
    <div
      className="rounded-2xl shadow-sm"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                Question {index + 1}
              </span>
              <StatusBadge status={breakdown.correct ? 'correct' : 'incorrect'} />
            </div>
            <div className="text-lg" style={{ color: 'var(--text)' }}>
              {isLongPrompt && !showFullPrompt
                ? question.prompt.slice(0, 150) + '...'
                : question.prompt}
            </div>
            {isLongPrompt && (
              <button
                onClick={() => setShowFullPrompt(!showFullPrompt)}
                className="text-sm mt-1"
                style={{ color: 'var(--accent)' }}
              >
                {showFullPrompt ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </div>

        {/* Answer Comparison */}
        <AnswerComparison
          isCorrect={breakdown.correct}
          userAnswer={breakdown.user_answer}
          correctAnswer={breakdown.correct_answer}
        />

        {/* Expand Feedback Button */}
        {breakdown.feedback && (
          <button
            onClick={onToggle}
            className="w-full mt-4 flex items-center justify-between px-4 py-3 rounded-xl transition-all"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            <span className="font-medium">Why this matters</span>
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Expandable Feedback */}
      <AnimatePresence>
        {isExpanded && breakdown.feedback && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{
              overflow: 'hidden',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--surface)',
            }}
          >
            <div className="p-6 flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--accent-soft)' }} // P0: Use existing token (theme-tokens.css line 131)
              >
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                  Feedback
                </div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {breakdown.feedback}
                </div>
                {breakdown.improvement && (
                  <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    <strong>Tip:</strong> {breakdown.improvement}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }: { status: 'correct' | 'incorrect' }) {
  const styles = {
    correct: {
      background: 'rgba(72, 226, 138, 0.15)',
      color: 'var(--text-success)',
      borderColor: 'var(--text-success)',
    },
    incorrect: {
      background: 'rgba(239, 68, 68, 0.08)',
      color: 'var(--text-danger)',
      borderColor: 'var(--text-danger)',
    },
  };

  const labels = {
    correct: 'Correct',
    incorrect: 'Incorrect',
  };

  const style = styles[status];

  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
      style={{
        background: style.background,
        color: style.color,
        border: `1px solid ${style.borderColor}`,
      }}
    >
      {labels[status]}
    </span>
  );
}

// ===== MAIN COMPONENT =====

export function AttemptReview({
  attempt,
  mode = 'full',
  onRetake,
  onGenerateNew,
  onBack,
  isRetaking = false,
}: AttemptReviewProps) {
  const [filter, setFilter] = useState<'all' | 'incorrect'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Computed insights
  const insights = useMemo(() => computeInsights(attempt), [attempt]);

  // Filter questions
  const visibleQuestions = useMemo(() => {
    return attempt.questions.filter((q) => {
      const breakdown = attempt.grading.find((b) => b.id === q.id);
      if (!breakdown) return false;

      if (filter === 'incorrect') return !breakdown.correct;
      return true;
    });
  }, [attempt.questions, attempt.grading, filter]);

  const incorrectCount = attempt.grading.filter((b) => !b.correct).length;

  // Toggle expanded state
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8">
      {/* Optional header for full mode */}
      {mode === 'full' && onBack && (
        <header
          className="sticky top-0 z-50 border-b backdrop-blur-md"
          style={{
            background: 'var(--bg)',
            opacity: 0.95,
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 transition-colors group"
              style={{ color: 'var(--text-muted)' }}
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Back</span>
            </button>
            <span className="text-sm" style={{ color: 'var(--text-soft)' }}>
              Export Results
            </span>
          </div>
        </header>
      )}

      {/* Hero scorecard */}
      <ScoreHero
        insights={insights}
        mode={mode}
        onRetake={onRetake}
        onGenerateNew={onGenerateNew}
        isRetaking={isRetaking}
      />

      {/* Insights strip */}
      <InsightStrip insights={insights} />

      {/* Review toolbar */}
      <ReviewToolbar
        filter={filter}
        onFilterChange={setFilter}
        totalCount={attempt.questions.length}
        incorrectCount={incorrectCount}
      />

      {/* Question cards */}
      <section className="space-y-6">
        {visibleQuestions.map((q, idx) => {
          const breakdown = attempt.grading.find((b) => b.id === q.id);
          if (!breakdown) return null;

          // Find the original index for question numbering
          const originalIdx = attempt.questions.findIndex((question) => question.id === q.id);

          return (
            <QuestionCard
              key={q.id}
              question={q}
              breakdown={breakdown}
              index={originalIdx}
              isExpanded={expandedIds.has(q.id)}
              onToggle={() => toggleExpanded(q.id)}
            />
          );
        })}
      </section>

      {/* Empty state when filtering */}
      {visibleQuestions.length === 0 && filter === 'incorrect' && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-success)' }} />
          <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Perfect score!
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            You answered all questions correctly.
          </div>
        </div>
      )}
    </div>
  );
}
