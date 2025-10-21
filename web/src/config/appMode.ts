/**
 * Global App Mode Configuration
 *
 * Determines whether the app runs in TEST or LIVE mode.
 * This affects Stripe keys, OpenAI keys, and frontend behavior.
 *
 * Usage:
 *   - Frontend: import { APP_MODE, IS_TEST } from '@/config/appMode'
 *   - Backend: Use process.env.APP_MODE directly
 */

export const APP_MODE = import.meta.env.VITE_APP_MODE || "live";
export const IS_TEST = APP_MODE === "test";

/**
 * Get a visual indicator for test mode (use in UI)
 */
export function getTestModeIndicator() {
  if (!IS_TEST) return null;

  return {
    label: "Test Mode",
    className: "text-xs text-yellow-400",
  };
}
