import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; message: string; closing?: boolean };

type ToastContextType = {
  push: (t: Omit<Toast, "id" | "closing">) => void;
  remove: (id: number) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Module-scoped bridge so `push()` works even outside React components
let bridgePush: ((t: Omit<Toast, "id" | "closing">) => void) | null = null;
let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Map<number, number>>(new Map());

  function remove(id: number) {
    // trigger exit animation first
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, closing: true } : t)));
    // after animation, remove from state
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      const to = timeouts.current.get(id);
      if (to) { window.clearTimeout(to); timeouts.current.delete(id); }
    }, 180); // keep in sync with transition duration
  }

  function push(t: Omit<Toast, "id" | "closing">) {
    const id = ++idCounter;
    const toast: Toast = { id, ...t };
    setToasts(prev => [...prev, toast]);
    // auto-dismiss after 4s
    const to = window.setTimeout(() => remove(id), 4000);
    timeouts.current.set(id, to);
  }

  useEffect(() => {
    bridgePush = push;
    return () => { bridgePush = null; };
  }, []);

  return (
    <ToastContext.Provider value={{ push, remove }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
          {toasts.map(t => (
            <button
              key={t.id}
              onClick={() => remove(t.id)}
              className={[
                "pointer-events-auto rounded-xl px-4 py-2 text-sm text-white shadow-lg transition-all duration-200",
                t.type === "success" ? "bg-green-600" : t.type === "error" ? "bg-red-600" : "bg-stone-700",
                // enter state
                t.closing ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
              ].join(" ")}
            >
              {t.message}
            </button>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

// Safe global push for non-hook usage (e.g., inside utility functions)
export function push(t: Omit<Toast, "id" | "closing">) {
  if (bridgePush) bridgePush(t);
  else console.warn("ToastProvider not mounted yet:", t.message);
}
