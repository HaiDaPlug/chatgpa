import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPage() {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setDone(true)
  }

  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-xl font-semibold mb-2">Set a new password</h1>
        {done ? (
          <p className="text-sm">Password updated. You can close this tab and sign in.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              required
              placeholder="New password (min 6 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 outline-none"
            />
            {error && <div className="text-rose-400 text-sm">{error}</div>}
            <button className="w-full rounded-xl bg-black/80 text-white py-2.5 font-medium hover:bg-black transition">
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
