import { useEffect, useRef } from "react";
import ChatBubble from "./ChatBubble";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  warning?: string;
};

export default function MessageList({
  messages,
  isLoading,
}: {
  messages: ChatMessage[];
  isLoading?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          warning={msg.warning}
        />
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-stone-800 border border-stone-700 animate-pulse">
            <p className="text-stone-400">Thinking...</p>
          </div>
        </div>
      )}

      {/* Invisible anchor for auto-scroll */}
      <div ref={endRef} />
    </div>
  );
}
