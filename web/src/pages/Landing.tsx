// Purpose: ChatGPA landing page - MVP placeholder
// Connects to: App.tsx, Supabase Auth

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getUserId, signOut } from '@/lib/supabase'
import { BookOpen, Zap, Brain } from 'lucide-react'

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin

export default function Landing() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getUserId().then(setUserId)

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })

    return () => authListener?.subscription?.unsubscribe?.()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${APP_URL}/` }
    })

    if (error) {
      alert(`Login failed: ${error.message}`)
    } else {
      alert('Check your email for the magic link!')
      setEmail('')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    setUserId(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-xl text-gray-900">ChatGPA</span>
          </div>
          <div>
            {userId ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Turn messy notes into <span className="text-indigo-600">adaptive quizzes</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Upload your study materials and let AI generate personalized quizzes with instant, adaptive grading
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="#login"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-lg"
          >
            Start Learning
          </a>
          <a
            href="#features"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-lg"
          >
            Learn More
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">How ChatGPA Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Notes</h3>
            <p className="text-gray-600">
              Paste your notes. (PDF upload coming soon)
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Generate Quiz</h3>
            <p className="text-gray-600">
              AI creates relevant quizzes from your material.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Brain className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Adaptive Grading</h3>
            <p className="text-gray-600">
              Flexible grading with clear, actionable feedback.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Simple Pricing</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="border-2 border-gray-200 rounded-2xl p-8 bg-white shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Free</h3>
            <p className="text-5xl font-extrabold mb-6 text-gray-900">$0</p>
            <ul className="text-gray-600 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span> 1 class
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span> 5 quizzes total
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span> Basic grading
              </li>
            </ul>
          </div>
          <div className="border-2 border-indigo-500 rounded-2xl p-8 bg-gradient-to-br from-indigo-50 to-white shadow-lg hover:shadow-xl transition-shadow relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-md">
              POPULAR
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Monthly Pro</h3>
            <p className="text-5xl font-extrabold mb-6 text-indigo-600">$9<span className="text-xl font-normal text-gray-500">/mo</span></p>
            <ul className="text-gray-700 space-y-3 text-sm font-medium">
              <li className="flex items-center gap-2">
                <span className="text-indigo-500">✓</span> Unlimited classes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-500">✓</span> Unlimited quizzes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-indigo-500">✓</span> Advanced grading
              </li>
            </ul>
          </div>
          <div className="border-2 border-gray-200 rounded-2xl p-8 bg-white shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3 text-gray-900">Annual Pro</h3>
            <p className="text-5xl font-extrabold mb-6 text-gray-900">$79<span className="text-xl font-normal text-gray-500">/yr</span></p>
            <ul className="text-gray-600 space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span> Everything in Monthly
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span> Save $29/year
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span> Priority support
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Login */}
      {!userId && (
        <section id="login" className="max-w-md mx-auto px-4 py-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-900">Get Started Free</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                We'll email you a magic link for a password-free sign in.
              </p>
            </form>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-gray-600 text-sm">
          © {new Date().getFullYear()} ChatGPA. Built with AI.
        </div>
      </footer>
    </div>
  )
}
