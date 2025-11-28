/**
 * Forgot Password Page
 *
 * Single-purpose page for requesting password reset email.
 * Matches visual style of Signin/Signup pages (split layout from sign-in-combined.html).
 *
 * Security: Always shows success message regardless of email existence to prevent
 * account enumeration attacks.
 *
 * Accessibility: Full ARIA support with role="status", aria-live="polite", aria-busy.
 *
 * Telemetry: Tracks password reset requests with fire-and-forget pattern, no PII.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/telemetry";
import { mapAuthError } from "@/lib/authErrors";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Handle password reset request
   *
   * Security critical: Always shows success message even if email doesn't exist.
   * This prevents account enumeration attacks.
   */
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault(); // ✅ Safe - prevent browser default
    if (isLoading) return; // ✅ Safe - guard against double-submit

    // Basic validation
    if (!email.trim()) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);
    track("auth_forgot_password_requested", {});

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // ✅ Security: Always show success message, never leak account existence
      // Even if error occurs (email not found), we show success to prevent enumeration
      if (error) {
        // Log error silently for debugging, but don't expose to user
        console.error("Password reset error:", error);
        track("auth_forgot_password_failed", { code: error.code ?? "unknown" });
      }

      // Always show success message
      setSuccessMessage(
        "If an account exists with that email, you'll receive a password reset link shortly."
      );

      // Clear form
      setEmail("");
    } catch (err) {
      // Even on exception, show success message for security
      console.error("Password reset exception:", err);
      track("auth_forgot_password_failed", { code: "exception" });

      setSuccessMessage(
        "If an account exists with that email, you'll receive a password reset link shortly."
      );
      setEmail("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[#0a0a0a]">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <Link
            to="/signin"
            className="inline-flex items-center gap-2 text-sm text-[#a3a3a3] hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white mb-2">
              Reset your password
            </h1>
            <p className="text-sm text-[#a3a3a3]">
              Enter your email address and we'll send you a link to reset your password.
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

          {/* Password Reset Form */}
          <form onSubmit={handlePasswordReset} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-[#171717] border border-[#404040] rounded-md text-white placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full py-2.5 bg-[#3b82f6] text-white rounded-md font-medium hover:bg-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-[#0a0a0a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>

          {/* Bottom Links */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#a3a3a3]">
              Remember your password?{" "}
              <Link
                to="/signin"
                className="text-[#3b82f6] hover:text-[#2563eb] font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-semibold text-white mb-4">
            Secure password recovery
          </h2>
          <p className="text-lg text-[#a3a3a3] leading-relaxed">
            We'll send you a secure link to reset your password. The link will expire after 1 hour for your security.
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
