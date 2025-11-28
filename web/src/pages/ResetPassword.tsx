/**
 * Reset Password Page
 *
 * Production-ready password reset page accessed via email reset link.
 * Matches visual style of Signin/Signup/ForgotPassword pages (split layout).
 *
 * Security: Validates session created by reset token, handles expired links gracefully.
 *
 * Accessibility: Full ARIA support with role="status", aria-live="polite", aria-busy.
 *
 * Telemetry: Tracks password reset events with fire-and-forget pattern, no PII.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";
import { mapAuthError } from "@/lib/authErrors";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Validate session on mount
   *
   * Supabase creates temporary session from email reset token via detectSessionInUrl: true
   * If no session exists, the reset link is invalid or expired
   */
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error || !session) {
          console.error("Reset password session error:", error);
          setHasValidSession(false);
          setErrorMessage("Your reset link is invalid or has expired. Please request a new one.");
        } else {
          setHasValidSession(true);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Reset password unexpected error:", err);
        setHasValidSession(false);
        setErrorMessage("Your reset link is invalid or has expired. Please request a new one.");
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Handle password reset submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // ✅ Safe - prevent browser default
    if (isLoading) return; // ✅ Safe - guard against double-submit

    // Client-side validation
    if (!password.trim() || !confirmPassword.trim()) {
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
    track("auth_reset_password_started", {});

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        const friendlyMessage = mapAuthError(error.code);
        setErrorMessage(friendlyMessage);
        track("auth_reset_password_failed", { code: error.code ?? "unknown" });
        return;
      }

      // Success
      setSuccessMessage(
        "Your password has been updated. You can now sign in with your new password."
      );
      track("auth_reset_password_success", {});

      // Clear form
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Reset password error:", err);
      setErrorMessage("Unable to update your password. Please try again or request a new reset link.");
      track("auth_reset_password_failed", { code: "exception" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignin = () => {
    navigate("/signin");
  };

  const handleRequestNewLink = () => {
    navigate("/forgot-password");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[#0a0a0a]">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white mb-2">
              Reset your password
            </h1>
            <p className="text-sm text-[#a3a3a3]">
              Choose a new password for your ChatGPA account.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 bg-[#262626] border border-[#dc2626] rounded-md px-3 py-2"
            >
              <p className="text-sm text-[#dc2626]">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 bg-[#262626] border border-[#525252] rounded-md px-3 py-2"
            >
              <p className="text-sm text-[#48E28A]">{successMessage}</p>
            </div>
          )}

          {/* Session Check / Invalid Link State */}
          {isCheckingSession ? (
            <div className="space-y-4">
              <p className="text-sm text-[#a3a3a3]">Verifying your reset link…</p>
            </div>
          ) : hasValidSession === false ? (
            <div className="space-y-4">
              <p className="text-sm text-[#a3a3a3]">
                Your password reset link is invalid or has expired. Request a new reset email to continue.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleRequestNewLink}
                  className="w-full py-2.5 bg-[#3b82f6] text-white rounded-md font-medium hover:bg-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] transition-all"
                >
                  Request new link
                </button>
                <button
                  type="button"
                  onClick={handleBackToSignin}
                  className="w-full py-2.5 bg-[#171717] border border-[#404040] text-white rounded-md font-medium hover:bg-[#262626] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] transition-all"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : successMessage ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleBackToSignin}
                className="w-full py-2.5 bg-[#3b82f6] text-white rounded-md font-medium hover:bg-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] transition-all"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white mb-1.5">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  aria-invalid={!!errorMessage}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-[#171717] border border-[#404040] rounded-md text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Enter a new password"
                />
                <p className="text-[0.75rem] text-[#737373] mt-1">
                  Use at least 8 characters
                </p>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-1.5">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  aria-invalid={!!errorMessage}
                  autoComplete="new-password"
                  className="w-full px-3 py-2 bg-[#171717] border border-[#404040] rounded-md text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Re-enter your new password"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="w-full py-2.5 bg-[#3b82f6] text-white rounded-md font-medium hover:bg-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Updating password…" : "Update password"}
              </button>

              <button
                type="button"
                onClick={handleBackToSignin}
                className="w-full py-2.5 bg-[#171717] border border-[#404040] text-white rounded-md font-medium hover:bg-[#262626] focus:outline-none focus:ring-2 focus:ring-[#404040] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] transition-all"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Right Panel - Hero/Visual */}
      <div className="hidden lg:flex lg:flex-1 bg-[#171717] items-center justify-center px-12 relative overflow-hidden">
        {/* Floating Gradient Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="floating-gradient absolute top-1/4 left-1/4 w-96 h-96 bg-[#3b82f6] opacity-20 rounded-full blur-3xl"></div>
          <div className="floating-gradient-delayed absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#8b5cf6] opacity-20 rounded-full blur-3xl"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-md">
          <div className="mb-6">
            <svg
              className="w-16 h-16 text-[#3b82f6]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-semibold text-white mb-4">
            Choose a secure password
          </h2>
          <p className="text-lg text-[#a3a3a3] leading-relaxed">
            Make sure your new password is strong and unique. We recommend using at least 8 characters with a mix of letters and numbers.
          </p>
        </div>
      </div>

      {/* Floating Animation Keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -30px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-30px, 30px); }
        }
        .floating-gradient {
          animation: float 20s ease-in-out infinite;
        }
        .floating-gradient-delayed {
          animation: float-delayed 25s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
