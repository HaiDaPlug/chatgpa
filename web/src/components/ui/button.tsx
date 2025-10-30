// web/src/components/ui/button.tsx
import * as React from "react";
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={"inline-flex items-center rounded-2xl px-4 py-2 bg-coral-500 hover:bg-coral-600 text-stone-50 disabled:opacity-50 " + (props.className ?? "")} />;
}
