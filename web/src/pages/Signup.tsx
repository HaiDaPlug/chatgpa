// Full Implementation - Production Ready
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";
import { mapAuthError } from "@/lib/authErrors"; // ✅ Safe - using shared utility

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Handle OAuth callback errors (Google sign-up uses same flow as sign-in)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      const friendlyMessage = errorDescription || "Unable to sign up with Google. Please try again.";
      setErrorMessage(friendlyMessage);
      track("auth_google_signup_failed", { method: "google", code: error });

      // Clean up URL
      navigate("/signup", { replace: true });
    }
  }, [navigate]);

  const handlePasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); // ✅ Safe - prevent browser default

    // ✅ Safe - guard against double-submit
    if (isLoading || isGoogleLoading) return;

    // Client-side validation
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);
    track("auth_signup_started", { method: "password" });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        const friendlyMessage = mapAuthError(error.code);
        setErrorMessage(friendlyMessage);
        track("auth_signup_failed", { method: "password", code: error.code ?? "unknown" });
        return;
      }

      // ✅ Safe - robust detection using both session AND user
      if (data.session && data.user) {
        // Email confirmation OFF → immediate session
        track("auth_signup_success", { method: "password", mode: "direct_login" });
        navigate("/dashboard", { replace: true });
      } else if (data.user && !data.session) {
        // Email confirmation ON → user created but no session yet
        setSuccessMessage("Check your email to confirm your account before signing in.");
        track("auth_signup_success", { method: "password", mode: "email_confirmation" });
        // Clear form
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      } else {
        // Unexpected state
        setErrorMessage("Something went wrong. Please try again.");
        track("auth_signup_failed", { method: "password", code: "unexpected_state" });
      }
    } catch (err) {
      console.error("Signup error:", err);
      setErrorMessage("Unable to create account. Please try again.");
      track("auth_signup_failed", { method: "password", code: "exception" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsGoogleLoading(true);
    track("auth_google_signup_started", { method: "google" });

    try {
      // ✅ Safe - centralize through signin page
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/signin",
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setErrorMessage("Unable to connect to Google. Please try again.");
      track("auth_google_signup_failed", {
        method: "google",
        code: error?.code ?? "unknown",
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-[#0a0a0a]">
      {/* LEFT COLUMN - FORM */}
      <div className="flex-1 flex flex-col justify-center px-16 py-16 max-[640px]:px-6 max-[640px]:py-8 relative">
        <Link
          to="/"
          className="absolute top-8 left-8 max-[640px]:top-4 max-[640px]:left-4 inline-flex items-center gap-3 px-5 py-3 text-base font-medium bg-[#171717] border border-[#404040] rounded-xl transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-[#262626] hover:border-[#525252] hover:-translate-x-0.5"
        >
          <span className="text-xl font-light leading-none">&lt;</span>
          <span className="text-[#e5e5e5]">Back</span>
        </Link>

        <div className="w-full flex flex-col gap-10">
          <div className="bg-[#171717] rounded-2xl border border-[#404040] px-6 py-7 flex flex-col gap-6 max-[640px]:px-5 max-[640px]:py-6">
            <div>
              <h1 className="text-[2.5rem] max-[640px]:text-[2rem] leading-[1.1] font-medium mb-2 text-[#e5e5e5] tracking-[-0.02em]">
                Create account
              </h1>
              <p className="text-base text-[#a3a3a3] font-normal">
                Start mastering your studies today.
              </p>
            </div>

            <form onSubmit={handlePasswordSignUp} className="flex flex-col gap-5">
              {/* Success Message - ✅ Safe with proper accessibility */}
              {successMessage && (
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-[#262626] border border-[#525252] rounded-md px-3 py-2"
                >
                  <p className="text-sm text-[#48E28A]">
                    {successMessage}
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="bg-[#262626] border border-[#525252] rounded-md px-3 py-2"
                >
                  <p className="text-sm text-[#ef4444]">
                    {errorMessage}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-[0.4rem]">
                <label htmlFor="email" className="text-[0.85rem] font-medium text-[#e5e5e5]">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  aria-invalid={!!errorMessage}
                  placeholder="student@university.edu"
                  autoComplete="email"
                  className="w-full h-11 rounded-[10px] border border-[#404040] bg-[#262626] px-[0.9rem] text-[0.9rem] text-[#e5e5e5] outline-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] placeholder:text-[#737373] focus:border-[#3b82f6] focus:shadow-[0_0_0_1px_#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-[0.4rem]">
                <label htmlFor="password" className="text-[0.85rem] font-medium text-[#e5e5e5]">
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
                  autoComplete="new-password"
                  className="w-full h-11 rounded-[10px] border border-[#404040] bg-[#262626] px-[0.9rem] text-[0.9rem] text-[#e5e5e5] outline-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] placeholder:text-[#737373] focus:border-[#3b82f6] focus:shadow-[0_0_0_1px_#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-[0.75rem] text-[#737373] mt-1">
                  Use at least 8 characters
                </p>
              </div>

              <div className="flex flex-col gap-[0.4rem]">
                <label htmlFor="confirmPassword" className="text-[0.85rem] font-medium text-[#e5e5e5]">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || isGoogleLoading}
                  aria-invalid={!!errorMessage}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full h-11 rounded-[10px] border border-[#404040] bg-[#262626] px-[0.9rem] text-[0.9rem] text-[#e5e5e5] outline-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] placeholder:text-[#737373] focus:border-[#3b82f6] focus:shadow-[0_0_0_1px_#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                aria-busy={isLoading}
                className="inline-flex items-center justify-center w-full h-11 rounded-full text-[0.95rem] font-medium bg-white text-black shadow-[0_4px_12px_rgba(255,255,255,0.1)] transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(255,255,255,0.15)] active:scale-[0.98] active:shadow-[0_2px_8px_rgba(255,255,255,0.1)] disabled:opacity-60 disabled:cursor-default disabled:shadow-none disabled:transform-none"
              >
                {isLoading ? "Creating account..." : "Create account"}
              </button>

              <div className="flex items-center gap-3 text-[0.75rem] uppercase tracking-[0.14em] text-[#737373]">
                <div className="flex-1 h-px bg-[#404040]"></div>
                <span>or continue with</span>
                <div className="flex-1 h-px bg-[#404040]"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isLoading || isGoogleLoading}
                aria-busy={isGoogleLoading}
                className="inline-flex items-center justify-center w-full h-11 rounded-full text-[0.95rem] font-medium bg-[#262626] text-[#e5e5e5] border border-[#404040] transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[#171717] active:translate-y-0 disabled:opacity-60 disabled:cursor-default disabled:shadow-none disabled:transform-none"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '0.5rem' }}>
                  <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
                  <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
                  <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
                  <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L14.9891 2.37682C13.4632 0.953182 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
                </svg>
                {isGoogleLoading ? "Connecting to Google..." : "Continue with Google"}
              </button>

              <div className="flex flex-col gap-2 mt-2 text-[0.85rem] text-[#a3a3a3]">
                <div className="flex gap-1">
                  <span>Already have an account?</span>
                  <Link
                    to="/signin"
                    className="no-underline text-[#a3a3a3] transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:text-[#3b82f6]"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN - HERO PANEL (identical to Signin.tsx) */}
      <div className="hidden min-[960px]:flex flex-1 relative p-8">
        <div className="relative w-full h-full min-h-[360px] rounded-[24px] bg-[#171717] border border-[#404040] overflow-hidden flex items-center justify-center p-10">
          {/* Background glows */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-[260px] h-[260px] rounded-full opacity-80 blur-[50px] bg-[rgba(59,130,246,0.28)] -top-[60px] -right-[60px]"></div>
            <div className="absolute w-[260px] h-[260px] rounded-full opacity-80 blur-[50px] bg-[rgba(38,38,38,0.9)] -bottom-[60px] -left-[60px]"></div>
          </div>

          {/* Background "messy notes" card */}
          <div className="absolute w-[280px] h-[360px] bg-[#262626] border border-[#404040] rounded-xl rotate-[-4deg] translate-x-[-30px] opacity-30 p-5 z-[1]">
            <div className="h-2 bg-[#404040] rounded mb-3 w-[40%]"></div>
            <div className="h-2 bg-[#404040] rounded mb-3 w-[80%]"></div>
            <div className="h-2 bg-[#404040] rounded mb-3 w-[60%]"></div>
            <div className="h-2 bg-[#404040] rounded mb-3 w-[80%]"></div>
            <div className="mt-5"></div>
            <div className="h-2 bg-[#404040] rounded mb-3 w-[60%]"></div>
            <div className="h-2 bg-[#404040] rounded mb-3 w-[80%]"></div>
            <div className="h-2 bg-[#404040] rounded mb-3 w-[40%]"></div>
          </div>

          {/* Foreground "clean quiz" card */}
          <div
            className="relative w-[320px] bg-[rgba(23,23,23,0.9)] backdrop-blur-xl border border-[#525252] rounded-2xl p-5 z-[2] shadow-[0_20px_50px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]"
            style={{
              animation: 'float 6s ease-in-out infinite',
            }}
          >
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-10px); }
                }
              `
            }} />

            <span className="inline-block px-[10px] py-1 bg-[#3b82f6] text-white text-[10px] uppercase tracking-[0.05em] rounded-full font-semibold mb-3">
              Biology 101
            </span>

            <h3 className="font-serif text-[1.1rem] text-[#e5e5e5] mb-4 leading-[1.4]">
              What is the main function of the mitochondria in a cell?
            </h3>

            <div className="flex items-center px-[14px] py-[10px] rounded-full border border-[#404040] mb-2 text-[#a3a3a3] text-[0.85rem] bg-[rgba(38,38,38,0.4)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]">
              <div className="w-4 h-4 border-2 border-[#525252] rounded-full mr-[10px] flex items-center justify-center flex-shrink-0"></div>
              Store genetic information
            </div>

            <div className="flex items-center px-[14px] py-[10px] rounded-full border border-[#3b82f6] mb-2 text-[#e5e5e5] text-[0.85rem] bg-[rgba(59,130,246,0.15)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]">
              <div className="w-4 h-4 border-2 border-[#3b82f6] bg-[#3b82f6] rounded-full mr-[10px] flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-white font-bold">✓</span>
              </div>
              Produce energy (ATP)
            </div>

            <div className="flex items-center px-[14px] py-[10px] rounded-full border border-[#404040] text-[#a3a3a3] text-[0.85rem] bg-[rgba(38,38,38,0.4)] transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]">
              <div className="w-4 h-4 border-2 border-[#525252] rounded-full mr-[10px] flex items-center justify-center flex-shrink-0"></div>
              Control cell division
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
