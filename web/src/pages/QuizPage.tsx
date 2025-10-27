import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { quizSchema } from '@/lib/quiz-schema'
import { saveAttempt } from '@/lib/attempts'
import { grade as remoteGrade } from '@/lib/grader' // your wrapper (server relay later)

type QuizQuestion =
  | { id: string; type: 'mcq'; prompt: string; options: string[]; answer: string }
  | { id: string; type: 'short'; prompt: string; answer: string }

type Quiz = { id: string; questions: QuizQuestion[] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function softLimit200(s: string) {
  return s.length <= 200 ? s : s.slice(0, 200)
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // answers map: { [qid]: student's text }
  const [answers, setAnswers] = useState<Record<string, string | undefined>>({})
  const [currentIdx, setCurrentIdx] = useState(0)

  // results state
  const [result, setResult] = useState<{
    score: number
    perQuestion: Array<{ questionId: string; correct: boolean; explanation: string; feedback: string }>
    summary: string
  } | null>(null)

  // fetch quiz by id from Supabase, validate, shuffle order
  useEffect(() => {
    let cancelled = false
    async function fetchQuiz() {
      try {
        setLoading(true)
        setError(null)
        const { data, error } = await supabase
          .from('quizzes')
          .select('id, questions')
          .eq('id', id)
          .single()
        if (error) throw error
        const parsed = quizSchema.parse({ questions: data.questions })
        const shuffled = shuffle(parsed.questions)
        if (!cancelled) {
          setQuiz({ id: data.id, questions: shuffled as QuizQuestion[] })
          setAnswers(Object.fromEntries(shuffled.map(q => [q.id, undefined])))
          setCurrentIdx(0)
        }
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load quiz')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) fetchQuiz()
    return () => { cancelled = true }
  }, [id])

  const q = useMemo(() => quiz?.questions[currentIdx], [quiz, currentIdx])
  const total = quiz?.questions.length ?? 0
  const answeredCount = useMemo(
    () => Object.values(answers).filter(v => v != null && v !== '').length,
    [answers]
  )
  const unansweredCount = total ? total - answeredCount : 0

  function setAnswer(qid: string, val: string) {
    setAnswers(prev => ({ ...prev, [qid]: val }))
  }

  function next() {
    if (!quiz) return
    setCurrentIdx(i => Math.min(i + 1, quiz.questions.length - 1))
  }
  function prev() {
    if (!quiz) return
    setCurrentIdx(i => Math.max(i - 1, 0))
  }

  async function onSubmit() {
    if (!quiz) return
    if (unansweredCount > 0) {
      const ok = window.confirm(`You have ${unansweredCount} unanswered. Submit anyway?`)
      if (!ok) return
    }

    try {
      // Try remote grading first (your API relay later). If it fails, do a tiny local fallback.
      const graded = await remoteGrade(quiz, answers).catch(() => localGrade(quiz, answers))
      setResult(graded)

      // Persist attempt for progress badge/history
      await saveAttempt({
        quiz_id: quiz.id,
        answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v ?? ''])),
        score: graded.score,
        perQuestion: graded.perQuestion,
        summary: graded.summary
      })
    } catch (e: any) {
      setError(e?.message ?? 'Failed to grade quiz')
    }
  }

  if (loading) return <div className="p-6">Loading quiz…</div>
  if (error) return (
    <div className="p-6 space-y-3">
      <div className="text-rose-400">{error}</div>
      <button className="rounded-xl bg-white/10 border border-white/10 px-3 py-2" onClick={() => nav(-1)}>
        Go back
      </button>
    </div>
  )
  if (!quiz) return null

  if (result) return <ResultsView quiz={quiz} result={result} onBack={() => nav(-1)} />

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="text-sm opacity-80">
          Question <b>{currentIdx + 1}</b> / {total} • Answered {answeredCount}/{total}
        </div>
        {unansweredCount > 0 && (
          <div className="text-xs px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {unansweredCount} unanswered
          </div>
        )}
      </header>

      <nav className="mb-3 flex flex-wrap gap-2">
        {quiz.questions.map((qq, idx) => {
          const answered = !!answers[qq.id]
          const active = idx === currentIdx
          return (
            <button
              key={qq.id}
              onClick={() => setCurrentIdx(idx)}
              className={[
                'w-9 h-9 rounded-lg text-sm border',
                active ? 'bg-white/20 border-white/30' : 'bg-white/5 border-white/10',
                answered ? 'ring-1 ring-emerald-400/50' : ''
              ].join(' ')}
              title={answered ? 'Answered' : 'Unanswered'}
            >
              {idx + 1}
            </button>
          )
        })}
      </nav>

      <QuestionCard
        q={q!}
        value={answers[q!.id] ?? ''}
        onChange={val => setAnswer(q!.id, val)}
      />

      <footer className="mt-6 flex items-center justify-between">
        <button onClick={prev} className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 disabled:opacity-50" disabled={currentIdx === 0}>
          Back
        </button>
        <div className="flex gap-2">
          <button onClick={next} className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 disabled:opacity-50" disabled={currentIdx === total - 1}>
            Next
          </button>
          <button onClick={onSubmit} className="rounded-xl bg-black/80 text-white px-4 py-2">
            Submit
          </button>
        </div>
      </footer>
    </div>
  )
}

function QuestionCard({
  q, value, onChange
}: {
  q: QuizQuestion
  value: string
  onChange: (val: string) => void
}) {
  if (q.type === 'mcq') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-medium mb-3">{q.prompt}</h2>
        <div className="grid gap-2">
          {q.options.map(opt => {
            const selected = value === opt
            return (
              <label key={opt} className={[
                'rounded-xl border px-3 py-2 cursor-pointer',
                selected ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/5'
              ].join(' ')}>
                <input
                  type="radio"
                  name={q.id}
                  className="sr-only"
                  checked={selected}
                  onChange={() => onChange(opt)}
                />
                {opt}
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  // short
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-lg font-medium mb-3">{q.prompt}</h2>
      <textarea
        value={value}
        onChange={e => onChange(softLimit200(e.target.value))}
        placeholder="Type your answer (keep it concise)"
        className="w-full min-h-[120px] rounded-xl bg-white/10 border border-white/10 p-3 outline-none"
      />
      <div className="mt-2 text-xs opacity-70">{(value?.length ?? 0)}/200</div>
    </div>
  )
}

function ResultsView({
  quiz, result, onBack
}: {
  quiz: Quiz
  result: { score: number; perQuestion: Array<{ questionId: string; correct: boolean; explanation: string; feedback: string }>; summary: string }
  onBack: () => void
}) {
  const lookup = useMemo(() => Object.fromEntries(quiz.questions.map(q => [q.id, q])), [quiz])
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Results</h1>
        <div className="rounded-lg px-3 py-1 border border-white/10 bg-white/5">
          Score: <b>{result.score}%</b>
        </div>
      </header>

      <div className="space-y-4">
        {result.perQuestion.map((r) => {
          const q = lookup[r.questionId]
          return (
            <div key={r.questionId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm opacity-80">Q: {q?.prompt}</div>
                <div className={r.correct ? 'text-emerald-400' : 'text-rose-400'}>
                  {r.correct ? 'Correct' : 'Incorrect'}
                </div>
              </div>
              {q?.type === 'mcq' && (
                <div className="text-xs opacity-80 mb-1">Correct answer: <b>{q.answer}</b></div>
              )}
              {q?.type === 'short' && (
                <div className="text-xs opacity-80 mb-1">Gold answer: <b>{q.answer}</b></div>
              )}
              <div className="text-sm">{r.explanation}</div>
              <div className="text-sm opacity-80">Tip: {r.feedback}</div>
            </div>
          )
        })}
      </div>

      <footer className="mt-6 flex items-center justify-between">
        <div className="text-sm opacity-80">Summary: {result.summary}</div>
        <button onClick={onBack} className="rounded-xl bg-white/10 border border-white/10 px-3 py-2">
          Back
        </button>
      </footer>
    </div>
  )
}

/** Very small local fallback grader (used only if remoteGrade throws).
 *  - MCQ: exact match
 *  - Short: lenient includes (case/punct ignored), checks for overlap in key words
 *  This is a stopgap; real grading is via your /api/grade relay.
 */
function localGrade(
  quiz: Quiz,
  answers: Record<string, string | undefined>
): { score: number; perQuestion: Array<{ questionId: string; correct: boolean; explanation: string; feedback: string }>; summary: string } {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  const stop = new Set(['the','a','an','of','and','or','to','in','on','for','with','is','are','was','be'])
  const words = (s: string) => norm(s).split(' ').filter(w => w && !stop.has(w))
  const per: Array<{ questionId: string; correct: boolean; explanation: string; feedback: string }> = []

  for (const q of quiz.questions) {
    const student = answers[q.id]?.trim() ?? ''
    if (q.type === 'mcq') {
      const correct = student === q.answer
      per.push({
        questionId: q.id,
        correct,
        explanation: correct ? 'Selected the correct option.' : 'Selected a different option.',
        feedback: correct ? 'Nice! Keep pace.' : 'Review the concept and why the other options are distractors.'
      })
    } else {
      const gold = words(q.answer)
      const stu = new Set(words(student))
      const overlap = gold.filter(w => stu.has(w)).length
      const correct = overlap >= Math.max(1, Math.ceil(gold.length * 0.5)) // ~50% key-word overlap
      per.push({
        questionId: q.id,
        correct,
        explanation: correct ? 'Core idea present despite phrasing.' : 'Key idea(s) missing.',
        feedback: correct ? 'Good—stay concise and precise.' : 'Revisit the definition and primary mechanism.'
      })
    }
  }
  const correctCount = per.filter(p => p.correct).length
  const score = Math.round((correctCount / quiz.questions.length) * 100)
  const summary = score >= 80 ? 'Strong understanding; keep practicing edge cases.' : 'Focus on definitions and contrasts from your notes.'
  return { score, perQuestion: per, summary }
}
