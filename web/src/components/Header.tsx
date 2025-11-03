export function Header() {
  return (
    <div className="h-14 flex items-center justify-between px-6"
         style={{ backdropFilter: "saturate(120%) blur(6px)" }}>
      {/* Breadcrumb / context */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>Home</span> <span>/</span> <b className="text-[var(--text)] font-semibold">Dashboard</b>
      </div>

      {/* Search + quick actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 surface bdr radius px-3 py-2 w-[clamp(240px,40vw,520px)] focus-ring">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C8.01 14 6 11.99 6 9.5S8.01 5 10.5 5 15 7.01 15 9.5 12.99 14 10.5 14"></path></svg>
          <input className="bg-transparent outline-none w-full text-sm" placeholder="Search classes, notes, quizzes…" />
          <kbd className="text-[12px] text-muted">⌘K</kbd>
        </div>
        <button className="btn ghost">Sync</button>
        <button className="btn primary">+ New</button>
        <div className="w-7 h-7 rounded-full bdr" style={{ background:"#ddd" }} />
      </div>
    </div>
  );
}

/* lightweight button styles (token-aware) */
declare global { interface CSSStyleDeclaration { } }
