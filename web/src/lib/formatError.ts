/**
 * PROMPT 6: Error & Warning Surfacing
 *
 * Maps API error codes to user-friendly messages.
 * Keeps technical details minimal and actionable.
 */

export type ErrorCode = string;

/**
 * Convert an API error code to a user-friendly message
 */
export function formatError(errorCode?: string, detail?: string): string {
  if (!errorCode) {
    return "Chat failed. Please retry.";
  }

  // Known error codes with friendly messages
  const errorMessages: Record<string, string> = {
    // Request validation errors
    invalid_body: "Your message was invalid (too long or malformed).",
    invalid_request: "Your message was invalid (too long or malformed).",

    // Fuel/balance errors
    insufficient_fuel: "You're out of fuel. Refuel on the Pricing page.",

    // OpenAI errors
    openai_error: "The model had a hiccup. Try sending again.",
    openai_timeout: "The model took too long. Try again.",
    openai_call_error: "The model couldn't respond. Try again.",
    invalid_model: "That model isn't allowed.",

    // Server configuration
    server_config_missing: "Server isn't fully configured.",
    missing_api_key: "Server isn't fully configured.",

    // Authentication/authorization
    auth_required: "You need to sign in to chat.",
    unauthorized: "You need to sign in to chat.",
    forbidden: "You don't have permission to use this model.",

    // Rate limiting
    rate_limited: "You're sending messages too fast. Please wait a moment.",
    rate_limit: "You're sending messages too quickly. Wait a moment.",
    quota_exceeded: "You've reached your usage limit.",

    // Accounting errors (these shouldn't block the message)
    spend_tokens_failed: "We couldn't record your fuel spend. Your balance is safe; try again.",
    usage_log_failed: "We couldn't log usage this time. You can continue; we're on it.",

    // Generic HTTP errors
    http_400: "Your request was invalid. Please retry.",
    http_401: "You need to sign in to chat.",
    http_403: "You don't have permission to use this feature.",
    http_404: "Chat service not found.",
    http_429: "Too many requests. Wait a moment.",
    http_500: "Server error. Please retry.",
    http_502: "Server error. Please retry.",
    http_503: "Service temporarily unavailable. Try again.",

    // Network errors
    timeout: "The request timed out. Try again.",
    network_error: "Connection failed. Check your network.",

    // Parsing errors
    invalid_response: "Server returned invalid data. Please retry.",

    // Chat-specific errors
    chat_failed: "Chat failed. Please retry.",
    no_reply: "No response received. Please retry.",

    // Unknown/fallback
    unknown: "Something went wrong. Please try again.",
  };

  const message = errorMessages[errorCode] || "Chat failed. Please retry.";

  // If there's a detail and it's not too technical, append it
  // Otherwise just return the friendly message
  if (detail && detail.length < 100 && !detail.includes("Error:")) {
    return `${message} (${detail})`;
  }

  return message;
}

/**
 * Check if warnings array contains accounting-related failures
 */
export function hasAccountingWarning(warnings?: string[]): boolean {
  if (!warnings || warnings.length === 0) return false;

  return warnings.some(w =>
    w.includes('spend_tokens_failed') ||
    w.includes('usage_log_failed') ||
    w.includes('accounting')
  );
}

/**
 * Format warnings array into user-friendly message
 */
export function formatWarnings(warnings?: string[]): string | undefined {
  if (!warnings || warnings.length === 0) return undefined;

  // Check for accounting warnings specifically
  if (hasAccountingWarning(warnings)) {
    return "Message delivered, but accounting had an issue.";
  }

  // For other warnings, just join them
  return warnings.join(", ");
}
