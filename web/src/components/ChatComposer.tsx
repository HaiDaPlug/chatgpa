import { useState, KeyboardEvent } from "react";

export default function ChatComposer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [inFlight, setInFlight] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || disabled || inFlight) return;

    setInFlight(true);
    setInput("");

    try {
      await onSend(text);
    } catch (err) {
      console.error("Send failed:", err);
      // Restore input on error
      setInput(text);
    } finally {
      setInFlight(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Note: Shift+Enter for newline doesn't apply to single-line input
    // If textarea is needed later, this will work naturally
  };

  const isDisabled = disabled || inFlight;
  const canSend = !isDisabled && input.trim().length > 0;

  return (
    <div className="flex gap-3">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={isDisabled}
        className="flex-1 rounded-xl bg-stone-800 border border-stone-700 px-4 py-3 text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        className="relative rounded-xl bg-white text-stone-900 px-6 py-3 font-medium hover:bg-stone-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
      >
        {inFlight ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Send</span>
          </span>
        ) : (
          "Send"
        )}
      </button>
    </div>
  );
}
