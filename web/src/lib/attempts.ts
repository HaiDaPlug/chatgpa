import { supabase } from '@/lib/supabaseClient'

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
