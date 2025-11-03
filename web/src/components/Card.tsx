import { ReactNode } from "react";

export function Card({ title, meta, children }:{
  title: string; meta?: string; children?: ReactNode;
}) {
  return (
    <article className="surface bdr radius elev-1 p-6 transition-transform hover:-translate-y-[2px]">
      <h3 className="m-0 text-[18px] font-semibold">{title}</h3>
      {meta && <div className="text-[13px] text-muted mb-3">{meta}</div>}
      {children}
    </article>
  );
}
