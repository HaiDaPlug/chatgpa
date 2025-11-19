// Purpose: Sign in page with email/password and Google OAuth
// Connects to: App.tsx routing, Supabase Auth

import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";
import { motion } from "framer-motion";

export default function Signin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSignIn(e: FormEvent) {
    e.preventDefault();

    // Basic validation
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError(null);
    track("auth_signin_started", { method: "password" });

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.session) {
        track("auth_signin_success", { method: "password" });
        navigate("/dashboard");
      }
    } catch (err: any) {
      track("auth_signin_failed", { method: "password" });

      // User-friendly error messages
      let errorMessage = "Sign in failed. Please try again.";

      if (err.message?.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (err.message?.includes("Email not confirmed")) {
        errorMessage = "Please confirm your email address before signing in.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setOauthLoading(true);
    setError(null);
    track("auth_google_signin_started");

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }

      // OAuth will redirect, so we stay in loading state
    } catch (err: any) {
      track("auth_google_signin_failed");
      setError(err.message || "Google sign in failed. Please try again.");
      setOauthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.18,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="w-full max-w-md"
      >
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {/* Header */}
          <div className="mb-6 text-center">
            <h1
              className="text-2xl font-semibold mb-2"
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--text)",
              }}
            >
              Sign in to ChatGPA
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Welcome back. Let's get you studying again.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="mb-4 rounded-md px-3 py-2 text-sm"
              role="alert"
              aria-live="polite"
              style={{
                border: "1px solid var(--border-strong)",
                background: "var(--surface-subtle)",
                color: "var(--text-danger)",
              }}
            >
              {error}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading || oauthLoading}
                className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none"
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent)";
                  e.target.style.boxShadow = "0 0 0 3px var(--accent-soft), 0 0 0 4px var(--accent)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--text)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading || oauthLoading}
                className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none"
                style={{
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent)";
                  e.target.style.boxShadow = "0 0 0 3px var(--accent-soft), 0 0 0 4px var(--accent)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-subtle)";
                  e.target.style.boxShadow = "none";
                }}
                required
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all focus:outline-none active:scale-[0.98]"
              style={{
                background: loading ? "var(--surface-subtle)" : "var(--accent)",
                color: loading ? "var(--text-muted)" : "var(--accent-text)",
                boxShadow: loading ? "none" : "0 1px 2px rgba(0,0,0,0.1)",
                opacity: loading || oauthLoading ? 0.6 : 1,
                cursor: loading || oauthLoading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading && !oauthLoading) {
                  e.currentTarget.style.background = "var(--accent-strong)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(91,122,230,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !oauthLoading) {
                  e.currentTarget.style.background = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-soft), 0 0 0 4px var(--accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = loading ? "none" : "0 1px 2px rgba(0,0,0,0.1)";
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-subtle)" }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              or continue with
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--border-subtle)" }}
            />
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading || oauthLoading}
            className="w-full px-4 py-2.5 rounded-md font-medium text-sm transition-all flex items-center justify-center gap-2 focus:outline-none active:scale-[0.98]"
            style={{
              background: "var(--surface-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
              opacity: loading || oauthLoading ? 0.6 : 1,
              cursor: loading || oauthLoading ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!loading && !oauthLoading) {
                e.currentTarget.style.background = "var(--surface-raised)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !oauthLoading) {
                e.currentTarget.style.background = "var(--surface-subtle)";
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-soft), 0 0 0 4px var(--accent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Google Icon (monochrome) */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="currentColor"
                opacity="0.8"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="currentColor"
                opacity="0.7"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="currentColor"
                opacity="0.6"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="currentColor"
                opacity="0.8"
              />
            </svg>
            {oauthLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          {/* Footer Links */}
          <div className="mt-6 flex items-center justify-between text-xs">
            <Link
              to="/forgot-password"
              className="transition-colors focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              Forgot your password?
            </Link>
            <Link
              to="/signup"
              className="transition-colors focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
