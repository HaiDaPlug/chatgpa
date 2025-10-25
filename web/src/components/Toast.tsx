import { createContext, useContext, useState, useCallback } from "react";

type Toast = { id: string; message: string; type?: "success" | "error" | "info" };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((s) => [...s, { id, ...t }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[9999] mx-auto flex max-w-lg flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg ${
              t.type === "error"
                ? "border-red-700 bg-red-900/70 text-red-100"
                : t.type === "success"
                ? "border-emerald-700 bg-emerald-900/70 text-emerald-100"
                : "border-stone-700 bg-stone-900/70 text-stone-100"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() { return useContext(ToastCtx); }
