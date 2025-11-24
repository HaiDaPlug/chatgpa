import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";

export default function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  // Handle OAuth callback errors
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      const friendlyMessage = errorDescription || "Unable to sign in with Google. Please try again.";
      setErrorMessage(friendlyMessage);
      track("auth_google_signin_failed", { method: "google", code: error });

      // Clean up URL
      navigate("/signin", { replace: true });
    }
  }, [navigate]);

  const mapErrorToMessage = (code: string | undefined): string => {
    switch (code) {
      case "invalid_credentials":
        return "Invalid email or password.";
      case "email_not_confirmed":
        return "Please verify your email before signing in.";
      case "too_many_requests":
        return "Too many attempts. Please try again later.";
      default:
        return "Unable to sign in. Please try again.";
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    track("auth_signin_started", { method: "password" });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      track("auth_signin_success", { method: "password" });
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      const friendlyMessage = mapErrorToMessage(error?.code);
      setErrorMessage(friendlyMessage);
      track("auth_signin_failed", {
        method: "password",
        code: error?.code ?? "unknown",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    track("auth_google_signin_started", { method: "google" });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/signin",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setErrorMessage("Unable to connect to Google. Please try again.");
      track("auth_google_signin_failed", {
        method: "google",
        code: error?.code ?? "unknown",
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)] flex">
      {/* LEFT COLUMN */}
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-10">
          {/* Logo */}
          <div className="space-y-3">
            <div className="logo text-[0.75rem] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-soft)]">
              ChatGPA
            </div>

            {/* Header */}
            <div>
              <h1 className="text-[2.3rem] leading-tight font-serif text-[color:var(--text)]">
                Sign in to ChatGPA
              </h1>
              <p className="text-[0.95rem] text-[color:var(--text-muted)] mt-2 max-w-xs">
                Welcome back. Let's get you studying again.
              </p>
            </div>
          </div>

          {/* FORM CARD */}
          <div className="bg-[color:var(--surface)] border border-[color:var(--border-subtle)] rounded-2xl p-6 space-y-6 shadow-sm">
            <form onSubmit={handlePasswordSignIn} className="space-y-5">
              {/* Error Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="bg-[color:var(--surface-subtle)] border border-[color:var(--border-strong)] rounded-md px-3 py-2"
                >
                  <p className="text-sm text-[color:var(--text-danger)]">
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-[0.85rem] font-medium text-[color:var(--text)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  aria-invalid={!!errorMessage}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full h-11 rounded-xl bg-[color:var(--surface-subtle)] border border-[color:var(--border-subtle)]
                  px-3 text-[0.9rem] text-[color:var(--text)] outline-none
                  focus-visible:border-[color:var(--accent)] focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]
                  disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[0.85rem] font-medium text-[color:var(--text)]"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  aria-invalid={!!errorMessage}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 rounded-xl bg-[color:var(--surface-subtle)] border border-[color:var(--border-subtle)]
                  px-3 text-[0.9rem] text-[color:var(--text)] outline-none
                  focus-visible:border-[color:var(--accent)] focus-visible:ring-1 focus-visible:ring-[color:var(--accent)]
                  disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-[0.85rem] text-[color:var(--text-muted)] hover:text-[color:var(--accent)] transition-colors"
                >
                  Forgot your password?
                </Link>
              </div>

              {/* Primary CTA */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                aria-busy={isLoading}
                className="w-full h-11 rounded-full bg-[color:var(--accent)] text-[color:var(--accent-text)]
                shadow-[0_10px_30px_rgba(59,130,246,0.25)]
                font-medium text-[0.95rem]
                transition-all duration-150
                hover:translate-y-[-1px] hover:shadow-[0_14px_40px_rgba(59,130,246,0.35)]
                active:translate-y-0 active:shadow-[0_8px_22px_rgba(59,130,246,0.2)]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                <div className="h-px flex-1 bg-[color:var(--border-subtle)]" />
                <span>or continue with</span>
                <div className="h-px flex-1 bg-[color:var(--border-subtle)]" />
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
                aria-busy={isGoogleLoading}
                className="w-full h-11 rounded-full bg-[color:var(--surface-subtle)]
                border border-[color:var(--border-subtle)]
                text-[color:var(--text)] text-[0.95rem] font-medium
                flex items-center justify-center gap-2
                transition-all duration-150
                hover:translate-y-[-1px] hover:bg-[color:var(--surface)]
                active:translate-y-0
                disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                <span
                  className="flex items-center justify-center h-5 w-5 rounded-full
                bg-[color:var(--bg)] text-[0.7rem] font-semibold"
                >
                  G
                </span>
                {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
              </button>

              <div className="pt-1 text-[0.85rem] text-[color:var(--text-muted)] space-x-1">
                <span>Don't have an account?</span>
                <Link
                  to="/signup"
                  className="hover:text-[color:var(--accent)] transition-colors"
                >
                  Sign up
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT HERO PANEL */}
      <div className="hidden lg:flex flex-1 items-center justify-center px-10 py-10 relative">
        <div
          className="relative w-full h-full max-w-xl bg-[color:var(--surface)]
        border border-[color:var(--border-subtle)] rounded-3xl overflow-hidden
        shadow-[0_0_40px_rgba(0,0,0,0.4)]
        flex items-center justify-center p-10"
        >
          {/* Glow layers */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[color:var(--accent-soft)] blur-[70px]" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-[color:var(--surface-subtle)] blur-[70px]" />
          </div>

          {/* Foreground content */}
          <div className="relative z-10 max-w-xs space-y-4">
            <div className="text-[0.75rem] uppercase tracking-[0.2em] text-[color:var(--text-soft)]">
              Study snapshot
            </div>

            <div className="text-[1.35rem] font-semibold leading-tight">
              Turn messy notes into{" "}
              <span className="text-[color:var(--accent)]">focused quizzes</span>.
            </div>

            <p className="text-[0.95rem] text-[color:var(--text-muted)]">
              See one question at a time, track attempts, and let ChatGPA
              highlight what you don’t know yet.
            </p>

            {/* Small quiz card */}
            <div
              className="rounded-2xl bg-[color:var(--bg)]/70 border border-[color:var(--border-subtle)]
            p-4 space-y-2 backdrop-blur-sm"
            >
              <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[color:var(--text-soft)]">
                Example question
              </div>

              <div className="text-[0.9rem] text-[color:var(--text)]">
                What is the main function of the mitochondria in a cell?
              </div>

              <div className="space-y-2 pt-1">
                {["Store genetic information", "Produce energy (ATP)", "Control cell division"].map(
                  (opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-full bg-[color:var(--surface-subtle)]
                      text-[0.8rem] text-[color:var(--text-muted)]"
                    >
                      <div className="h-[14px] w-[14px] rounded-full border border-[color:var(--border-subtle)] bg-black/40" />
                      {opt}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="text-[0.7rem] text-[color:var(--text-soft)] pt-1">
              This visual will later be replaced with a Canva animation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
