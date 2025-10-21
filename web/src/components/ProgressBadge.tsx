import { useEffect, useState } from 'react'
import { getProgressSummary, type ProgressSummary } from '@/lib/progress'

export function ProgressBadge() {
  const [state, setState] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getProgressSummary()
      .then((s) => mounted && setState(s))
      .catch(() => mounted && setState(null))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm animate-pulse">
        Loading progress…
      </div>
    )
  }
  if (!state) return null

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">Progress</span>
        <span className="opacity-80">Attempts: {state.totalAttempts}</span>
        <span className="opacity-80">Avg: {state.averageScore}%</span>
        {state.lastScore != null && (
          <span className="opacity-80">
            Last: {state.lastScore}%{' '}
            {state.changeFromPrev != null && (
              <em className={state.changeFromPrev >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                ({state.changeFromPrev >= 0 ? '+' : ''}{state.changeFromPrev})
              </em>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
