import { supabase } from '@/lib/supabase'

export type ProgressSummary = {
  totalAttempts: number
  averageScore: number        // 0..100 (rounded)
  lastScore: number | null
  changeFromPrev: number | null
}

/** Lightweight “you’re improving” summary across all attempts for the user. */
export async function getProgressSummary(): Promise<ProgressSummary> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id, score, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(50) // cheap + enough for MVP trend
  if (error) throw error

  const total = data?.length ?? 0
  const avg = total
    ? Math.round((data!.reduce((s, a) => s + (a.score ?? 0), 0) / total))
    : 0
  const last = data?.[0]?.score ?? null
  const prev = data?.[1]?.score ?? null
  const delta = last != null && prev != null ? last - prev : null

  return { totalAttempts: total, averageScore: avg, lastScore: last, changeFromPrev: delta }
}

/** Save a quiz attempt with grading results */
export async function saveAttempt(params: {
  quizId: string
  responses: Record<string, string>
  grading: {
    score: number
    perQuestion: Array<{ questionId: string; correct: boolean; explanation: string; feedback: string }>
    summary: string
  }
}) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: params.quizId,
      user_id: auth.user.id,
      responses: params.responses,
      grading: params.grading,
      score: params.grading.score / 100, // DB stores 0..1
    })
    .select()
    .single()

  if (error) throw error
  return data
}
