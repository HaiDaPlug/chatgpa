// Lightweight relevance checker to ensure questions come from the provided notes.
// No schema changes; used before saving the quiz.

const STOP = new Set([
  'the','a','an','and','or','of','to','in','on','for','with','is','are','was','were','be','by','as','at','that','this','these','those'
])

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string) {
  return normalize(s).split(' ').filter(w => w && !STOP.has(w))
}

function jaccard(a: Set<string>, b: Set<string>) {
  const inter = new Set([...a].filter(x => b.has(x))).size
  const union = new Set([...a, ...b]).size
  return union ? inter / union : 0
}

export type RelevanceReport = {
  overallCoverage: number
  perQuestion: Array<{
    id: string
    scorePrompt: number
    scoreAnswer: number
    ok: boolean
    reason?: string
  }>
  ok: boolean
}

export function checkQuizRelevance(params: {
  notes: string
  quiz: { questions: Array<{ id: string; type: 'mcq'|'short'; prompt: string; answer: string; options?: string[] }> }
  thresholds?: { prompt: number; answer: number; overall: number }
}): RelevanceReport {
  const { notes, quiz } = params
  const th = { prompt: 0.28, answer: 0.28, overall: 0.35, ...(params.thresholds ?? {}) }

  const noteSet = new Set(tokens(notes))
  const per: RelevanceReport['perQuestion'] = []

  let okCount = 0
  for (const q of quiz.questions) {
    const pSet = new Set(tokens(q.prompt))
    const aSet = new Set(tokens(q.answer))
    const sp = jaccard(pSet, noteSet)
    const sa = jaccard(aSet, noteSet)
    const ok = sp >= th.prompt && sa >= th.answer
    if (ok) okCount++
    per.push({
      id: q.id, scorePrompt: Number(sp.toFixed(2)), scoreAnswer: Number(sa.toFixed(2)), ok,
      reason: ok ? undefined : 'Low overlap with notes'
    })
  }

  const overall = quiz.questions.length ? okCount / quiz.questions.length : 0
  return {
    overallCoverage: Number(overall.toFixed(2)),
    perQuestion: per,
    ok: overall >= th.overall
  }
}
