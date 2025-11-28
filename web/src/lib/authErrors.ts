/**
 * Shared authentication error mapping utility
 * Maps Supabase auth error codes to user-friendly messages
 * Used across Signup and ForgotPassword pages
 *
 * Note: Signin.tsx has its own local error mapper and should NOT be refactored
 * to prevent regression risk in production code.
 */

export function mapAuthError(code: string | undefined): string {
  switch (code) {
    // Sign in errors
    case "invalid_credentials":
      return "Invalid email or password.";
    case "email_not_confirmed":
      return "Please verify your email before signing in.";

    // Sign up errors
    case "user_already_exists":
      return "This email is already registered. Try signing in instead.";
    case "invalid_email":
      return "Please enter a valid email address.";
    case "weak_password":
      return "Password must be at least 6 characters.";

    // Rate limiting
    case "too_many_requests":
      return "Too many attempts. Please try again later.";

    // Network/server errors
    case "network_error":
      return "Network error. Please check your connection.";

    // Generic fallback
    default:
      return "Unable to complete authentication. Please try again.";
  }
}
