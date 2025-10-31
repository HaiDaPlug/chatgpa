// web/src/components/ui/dialog.tsx
import * as React from "react";
export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-stone-900 p-4 ring-1 ring-stone-800" onClick={(e)=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
