export default function ChatBubble({
  role,
  content,
  warning,
}: {
  role: "user" | "assistant";
  content: string;
  warning?: string;
}) {
  return (
    <div
      className={`flex ${
        role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div className="max-w-[80%] flex flex-col gap-2">
        <div
          className={`rounded-2xl px-4 py-3 ${
            role === "user"
              ? "bg-orange-500 text-white"
              : "bg-stone-800 text-stone-100 border border-stone-700"
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {warning && (
          <div className="flex items-center gap-1 text-xs text-amber-400 px-2">
            <span>⚠️</span>
            <span>{warning}</span>
          </div>
        )}
      </div>
    </div>
  );
}
