/**
 * PROMPT 6: Warning Banner
 *
 * Small dismissible banner for non-critical warnings
 * (e.g., accounting failures that don't block the message)
 */

import { useState } from "react";

type WarningBannerProps = {
  message: string;
  onDismiss?: () => void;
};

export function WarningBanner({ message, onDismiss }: WarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
      {/* Warning icon */}
      <span className="text-amber-400 text-lg flex-shrink-0">⚠️</span>

      {/* Message */}
      <p className="flex-1 text-sm text-amber-200">{message}</p>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="text-amber-400 hover:text-amber-300 transition-colors flex-shrink-0"
        aria-label="Dismiss warning"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
