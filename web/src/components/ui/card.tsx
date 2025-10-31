// web/src/components/ui/card.tsx
import * as React from "react";
export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={"rounded-2xl bg-stone-900 shadow-sm ring-1 ring-stone-800 " + (props.className ?? "")} />;
}
