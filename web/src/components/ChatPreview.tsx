/**
 * PROMPT 7: Landing ChatPreview
 *
 * Reuses actual Chat components (ChatBubble, MessageList, ChatComposer, FuelMeter)
 * for visual consistency between landing page and real chat.
 *
 * Key features:
 * - NO API calls - completely static
 * - Composer disabled (read-only preview)
 * - Fixed FuelMeter values (no polling)
 * - Canned conversation to demonstrate UI
 */

import { useState } from "react";
import { FuelMeter } from "@/components/FuelMeter";
import MessageList, { type ChatMessage } from "@/components/MessageList";
import ChatComposer from "@/components/ChatComposer";

// Canned conversation showcasing the chat UI
const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "demo-1",
    role: "user",
    content: "What makes Carpool AI different from ChatGPT?",
  },
  {
    id: "demo-2",
    role: "assistant",
    content: "Great question! Unlike ChatGPT's $20/month subscription, Carpool AI uses a transparent fuel system. You see exactly how many tokens you have and how much each message costs. No surprises, no wasted money on unused months.",
  },
  {
    id: "demo-3",
    role: "user",
    content: "How does the fuel system work?",
  },
  {
    id: "demo-4",
    role: "assistant",
    content: "Simple! When you subscribe, you get a fuel allocation (tokens). Each message drains fuel based on its length and complexity. You can track your usage in real-time with the fuel meter. Unused fuel carries over—no use-it-or-lose-it pressure.",
  },
];

export default function ChatPreview() {
  const [showFullConversation, setShowFullConversation] = useState(false);

  // Show either first 2 messages or full conversation
  const displayedMessages = showFullConversation
    ? DEMO_MESSAGES
    : DEMO_MESSAGES.slice(0, 2);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      {/* Chat Preview Column */}
      <div className="rounded-2xl border border-stone-700 bg-stone-800/50 overflow-hidden">
        {/* Mini Header (read-only indicator) */}
        <div className="border-b border-stone-700/70 bg-stone-900/80 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-stone-300">Chat Preview</h3>
            <span className="text-xs text-stone-500 px-2 py-1 rounded border border-stone-700/50 bg-stone-800/50">
              Read-only demo
            </span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="px-4 py-6 min-h-[320px] max-h-[400px] overflow-y-auto">
          <MessageList messages={displayedMessages} isLoading={false} />
        </div>

        {/* Footer with disabled composer */}
        <div className="border-t border-stone-700/70 bg-stone-900/80 px-4 py-4">
          <ChatComposer
            disabled={true}
            onSend={async () => {
              // No-op: composer is disabled
            }}
          />
          <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
            <span>💡 Log in to start chatting for real</span>
            {!showFullConversation && (
              <button
                onClick={() => setShowFullConversation(true)}
                className="text-stone-300 hover:text-white underline"
              >
                Show more
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fuel Meter Column */}
      <div className="rounded-2xl border border-stone-700 bg-stone-800/50 p-6 h-fit">
        <h3 className="text-sm font-medium text-stone-300 mb-4">Fuel Tracking</h3>

        {/* PROMPT 7: Fixed FuelMeter with static props (no userId, no API calls) */}
        <FuelMeter
          personal={356000}
          reserve={100000}
          pool={50000}
          total={506000}
        />

        <div className="mt-4 space-y-2 text-xs text-stone-400">
          <p>
            <span className="text-stone-300 font-medium">Real-time tracking:</span> Watch
            your fuel drain as you chat
          </p>
          <p>
            <span className="text-stone-300 font-medium">Transparent costs:</span> See
            exact token usage per message
          </p>
          <p>
            <span className="text-stone-300 font-medium">No surprises:</span> You control
            when to refuel
          </p>
        </div>
      </div>
    </div>
  );
}
