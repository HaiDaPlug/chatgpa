import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { IS_TEST } from "@/config/appMode";
import { FuelMeter } from "@/components/FuelMeter";
import { useLedger } from "@/hooks/useLedger";
import { supabase } from "@/lib/supabase";
import MessageList, { type ChatMessage } from "@/components/MessageList";
import ChatComposer from "@/components/ChatComposer";
import { WarningBanner } from "@/components/WarningBanner";
import { sendChat } from "@/lib/sendChat";
import { formatError, hasAccountingWarning } from "@/lib/formatError";

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // PROMPT 6: Track accounting warnings for banner
  const [accountingWarning, setAccountingWarning] = useState<string | null>(null);

  // Get user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // PROMPT B: Use ledger hook for balance tracking with optimistic updates
  const ledger = useLedger();

  // Handle ?new_purchase=1 query param
  useEffect(() => {
    if (searchParams.get("new_purchase") === "1") {
      // Show toast notification
      toast.success("Fuel added! 🚗");

      // PROMPT B: Trigger ledger refresh to show new fuel
      (async () => {
        await ledger.refresh();
        // Clean up URL after refresh completes
        navigate({ search: "" }, { replace: true });
      })();
    }
  }, [searchParams, navigate, ledger]);

  // Send chat message via API or mock
  const handleSend = async (text: string) => {
    if (!userId) {
      console.error("Cannot send: no userId");
      return;
    }

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setPending(true);

    try {
      // Call API (or mock)
      const result = await sendChat(updatedMessages, userId);

      if (result.ok && result.reply) {
        // Success - add assistant reply
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.reply,
          warning: result.warnings?.join(", "),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // PROMPT 5: Optimistic token drain
        if (result.usage?.total_tokens) {
          if (IS_TEST) {
            console.log(`[Chat] Draining ${result.usage.total_tokens} tokens optimistically`);
          }
          ledger.bump(-result.usage.total_tokens);
        }

        // PROMPT 6: Show banner for accounting warnings
        if (hasAccountingWarning(result.warnings)) {
          setAccountingWarning("Message delivered, but accounting had an issue.");
        }
      } else {
        // PROMPT 6: Format error with friendly message
        const friendlyError = formatError(result.error, result.detail);
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ ${friendlyError}`,
          warning: result.warnings?.join(", "),
        };
        setMessages((prev) => [...prev, errorMsg]);

        // Show error toast
        toast.error(friendlyError);

        // PROMPT 5: No token drain on error (no revert needed, we never bumped)
      }
    } catch (err: any) {
      console.error("Send error:", err);
      // PROMPT 6: Network/unexpected error with friendly message
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Connection failed. Check your network.`,
      };
      setMessages((prev) => [...prev, errorMsg]);

      // Show error toast
      toast.error("Connection failed. Check your network.");

      // PROMPT 5: No token drain on exception (no revert needed, we never bumped)
    } finally {
      setPending(false);
    }
  };

  // PROMPT B: Use ledger balance directly (optimistic updates via bump)
  const displayBalance = ledger.balance ?? 0;

  // PROMPT A (Revised): Gating logic - Allow chat in test/mock mode even with 0 balance
  const IS_MOCK = import.meta.env.VITE_CHAT_MOCK === '1';
  const hasFuel = displayBalance > 0;
  const isComposerDisabled = pending || (!IS_TEST && !IS_MOCK && !hasFuel);

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-stone-700/70 bg-stone-900/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Chat</h1>
            {IS_TEST && (
              <span className="text-xs text-yellow-400 px-2 py-0.5 rounded border border-yellow-400/30 bg-yellow-400/10">
                Test Mode
              </span>
            )}
          </div>

          {/* Right-aligned FuelMeter */}
          <div className="flex items-center gap-4">
            {IS_TEST && ledger.balance !== null && (
              <div className="text-xs text-stone-400">
                Balance: {ledger.balance.toLocaleString()}
                {ledger.tierCap && ` / ${ledger.tierCap.toLocaleString()}`}
              </div>
            )}
            <div className="w-64">
              {/* PROMPT 5: Override total with ledger balance for optimistic updates */}
              <FuelMeter userId={userId} total={displayBalance} />
            </div>
            <Link
              to="/pricing"
              className="rounded-xl px-3 py-1.5 bg-orange-500 text-black font-medium hover:bg-orange-400 transition text-sm"
            >
              Refuel
            </Link>
          </div>
        </div>
      </header>

      {/* Main: Scrollable Messages Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {/* PROMPT 6: Warning banner for accounting issues */}
          {accountingWarning && (
            <div className="mb-4">
              <WarningBanner
                message={accountingWarning}
                onDismiss={() => setAccountingWarning(null)}
              />
            </div>
          )}

          {messages.length === 0 ? (
            <div className="text-center text-stone-400 py-12">
              <p className="text-lg">Start a conversation with GPT-5</p>
              <p className="text-sm mt-2">Your messages will appear here</p>
            </div>
          ) : (
            <MessageList messages={messages} isLoading={pending} />
          )}
        </div>
      </main>

      {/* Footer: Fixed ChatComposer */}
      <footer className="sticky bottom-0 border-t border-stone-700/70 bg-stone-900/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <ChatComposer disabled={isComposerDisabled} onSend={handleSend} />

          {!hasFuel && !IS_TEST && !IS_MOCK && (
            <div className="mt-3 text-sm text-amber-400">
              ⚠️ Out of fuel.{" "}
              <a href="/pricing" className="underline hover:text-amber-300">
                Refuel to continue
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
