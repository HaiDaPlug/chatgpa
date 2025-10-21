import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { FuelMeter } from "@/components/FuelMeter";
import { useAccount } from "@/hooks/useAccount";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const assistantIndexRef = useRef<number | null>(null);
  const lastInputRef = useRef<string>("");

  // Get account data for fuel checks
  const { account } = useAccount(userId);
  const totalAvailable = account?.total_available ?? 0;

  // Get user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  async function sendChat(userText: string) {
    const prior = messages;
    const nextUser: Msg = { role: "user", content: userText };
    const msgList = [...prior, nextUser];

    // Optimistically add user message + placeholder assistant
    const assistantIndex = msgList.length;
    assistantIndexRef.current = assistantIndex;
    msgList.push({ role: "assistant", content: "" });
    setMessages(msgList);

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user_id = auth.user?.id;

      if (!user_id) {
        throw new Error("Not authenticated");
      }

      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: prior.map((m) => ({ role: m.role, content: m.content })).concat([nextUser]),
          user_id,
        }),
      });

      const j = await r.json();

      if (!r.ok || !j.ok) {
        const errorCode = j?.error || `chat_failed_${r.status}`;
        const errorDetail = j?.detail ? ` (${j.detail})` : "";
        throw new Error(`${errorCode}${errorDetail}`);
      }

      // Success - update assistant message with reply
      const reply = j.reply || "";
      setMessages((curr) => {
        if (assistantIndexRef.current == null) return curr;
        const idx = assistantIndexRef.current!;
        const clone = curr.slice();
        clone[idx] = { role: "assistant", content: reply };
        return clone;
      });

      // Show warnings if any
      if (j.warnings && j.warnings.length > 0) {
        console.warn("Chat API warnings:", j.warnings);
        setErrorMsg(`⚠️ ${j.warnings.join(", ")}`);
      } else {
        setErrorMsg(null);
      }

      setPendingId(null);

    } catch (e: any) {
      console.error("Chat error:", e);
      const errorMessage = e.message || "Connection lost. Retry?";
      setErrorMsg(errorMessage);

      setMessages((curr) => {
        if (assistantIndexRef.current == null) return curr;
        const idx = assistantIndexRef.current!;
        const clone = curr.slice();
        clone[idx] = {
          role: "assistant",
          content: `❌ Error: ${errorMessage}`,
        };
        return clone;
      });
      setPendingId(null);
    } finally {
      assistantIndexRef.current = null;
    }
  }

  async function onSend() {
    const text = input.trim();
    if (!text || pendingId) return;

    // Check if user has fuel
    if (totalAvailable <= 0) {
      setErrorMsg("Insufficient fuel. Refuel to continue chatting.");
      return;
    }

    const messageId = crypto.randomUUID();
    lastInputRef.current = text;
    setPendingId(messageId);
    setErrorMsg(null);
    setInput("");

    await sendChat(text);
  }

  async function retryLast() {
    if (!lastInputRef.current) return;
    setErrorMsg(null);
    setPendingId(crypto.randomUUID());
    await sendChat(lastInputRef.current);
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <FuelMeter userId={userId} />

      <div className="rounded-2xl border border-white/10 p-4 min-h-[40vh]">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className="inline-block px-3 py-2 my-1 rounded-xl bg-white/5">
              {m.content}
            </div>
          </div>
        ))}
        {pendingId && !errorMsg && (
          <div className="text-left">
            <div className="inline-block px-3 py-2 my-1 rounded-xl bg-white/5 animate-pulse">
              <span className="text-white/60">Sending…</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl bg-white/5 px-3 py-2 outline-none disabled:opacity-50"
            placeholder="Say hi to GPT-5…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={!!pendingId}
          />
          <button
            className="rounded-xl px-4 py-2 bg-white text-black disabled:opacity-50 transition-opacity"
            onClick={onSend}
            disabled={!!pendingId || !input.trim() || totalAvailable <= 0}
            title={totalAvailable <= 0 ? "Insufficient fuel" : undefined}
          >
            {pendingId ? 'Sending…' : 'Send'}
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <span>{errorMsg}</span>
            {errorMsg.includes("Insufficient fuel") ? (
              <a
                href="/account"
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                Refuel
              </a>
            ) : (
              <button
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                onClick={retryLast}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs opacity-60">
        Powered by OpenAI. Fuel updates in real-time via Supabase.
      </p>
    </div>
  );
}
