import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="p-6 text-sm opacity-70">Loading…</div>
  if (!session) return <SignInCard />

  return <>{children}</>
}

function SignInCard() {
  const [mode, setMode] = useState<'signin'|'signup'|'reset'>('signin')
  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h1 className="text-xl font-semibold mb-1">Welcome to ChatGPA</h1>
        <p className="text-sm opacity-70 mb-4">Sign in to save your classes, quizzes, and progress.</p>

        <GoogleButton />

        <div className="my-4 h-px bg-white/10" />

        {mode === 'reset' ? (
          <ResetPasswordForm onBack={() => setMode('signin')} />
        ) : (
          <>
            <EmailAuthForm mode={mode} />
            <div className="mt-3 flex items-center justify-between text-sm">
              {mode === 'signin' ? (
                <>
                  <button onClick={() => setMode('signup')} className="opacity-80 hover:opacity-100 underline">
                    Create an account
                  </button>
                  <button onClick={() => setMode('reset')} className="opacity-80 hover:opacity-100 underline">
                    Forgot password?
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setMode('signin')} className="opacity-80 hover:opacity-100 underline">
                    Have an account? Sign in
                  </button>
                  <span className="opacity-50"> </span>
                </>
              )}
            </div>
          </>
        )}
        <p className="text-xs opacity-60 mt-4">We only use your email for login. By continuing you agree to our Terms.</p>
      </div>
    </div>
  )
}

function GoogleButton() {
  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }
  return (
    <button
      onClick={signIn}
      className="w-full rounded-xl bg-white text-black py-2.5 font-medium hover:opacity-90 transition"
    >
      Continue with Google
    </button>
  )
}

function EmailAuthForm({ mode }: { mode: 'signin'|'signup' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}` }
        })
        if (error) throw error
        alert('Check your inbox to confirm your email, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 outline-none"
      />
      <input
        type="password"
        required
        placeholder="Password (min 6 chars)"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 outline-none"
      />
      {error && <div className="text-rose-400 text-sm">{error}</div>}
      <button
        disabled={loading}
        className="w-full rounded-xl bg-black/80 text-white py-2.5 font-medium hover:bg-black transition disabled:opacity-50"
      >
        {loading ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Sign in')}
      </button>
    </form>
  )
}

function ResetPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div>
      <form onSubmit={sendReset} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-2 outline-none"
        />
        {error && <div className="text-rose-400 text-sm">{error}</div>}
        <button className="w-full rounded-xl bg-black/80 text-white py-2.5 font-medium hover:bg-black transition">
          Send reset link
        </button>
      </form>
      <div className="text-sm opacity-80 mt-3">
        {sent ? 'Reset link sent. Check your inbox.' : <button onClick={onBack} className="underline">Back</button>}
      </div>
    </div>
  )
}
