import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "react-router-dom";

export function Sidebar({ collapsed, onToggle }:{collapsed:boolean; onToggle:()=>void}) {
  return (
    <div className="h-full flex flex-col p-4">
      {/* Logo / collapse toggle */}
      <div className="flex items-center justify-between mb-6">
        {!collapsed && <h2 className="text-[18px] font-semibold m-0">ChatGPA</h2>}
        <button onClick={onToggle} className="btn ghost p-2">
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 grid gap-1">
        <Tree label="My Classes" items={["ECON 101","CS 305","MATH 250"]} collapsed={collapsed}/>
        <Tree label="Recent Quizzes" items={[]} collapsed={collapsed}/>
        <Tree label="Settings" items={[]} collapsed={collapsed}/>
      </nav>

      {/* Study Tools Section */}
      {!collapsed && (
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="text-muted px-3 mb-2" style={{ fontSize: "12px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Study Tools
          </div>
          <nav className="grid gap-1">
            <NavLink
              to="/tools/generate"
              className={({ isActive }) =>
                `block px-3 py-2 radius text-[14px] transition-colors ${
                  isActive
                    ? "font-medium"
                    : "text-muted hover:surface-2"
                }`
              }
              style={({ isActive }) => isActive ? { color: "var(--accent)", background: "var(--surface-2)" } : {}}
            >
              Generate Quiz
            </NavLink>
            <NavLink
              to="/tools/flashcards"
              className={({ isActive }) =>
                `block px-3 py-2 radius text-[14px] transition-colors ${
                  isActive
                    ? "font-medium"
                    : "text-muted hover:surface-2"
                }`
              }
              style={({ isActive }) => isActive ? { color: "var(--accent)", background: "var(--surface-2)" } : {}}
            >
              Flashcards
            </NavLink>
            <NavLink
              to="/tools/summarize"
              className={({ isActive }) =>
                `block px-3 py-2 radius text-[14px] transition-colors ${
                  isActive
                    ? "font-medium"
                    : "text-muted hover:surface-2"
                }`
              }
              style={({ isActive }) => isActive ? { color: "var(--accent)", background: "var(--surface-2)" } : {}}
            >
              Summarize
            </NavLink>
          </nav>
        </div>
      )}
    </div>
  );
}

function Tree({ label, items = [], collapsed }:{label:string; items?:string[]; collapsed?:boolean}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        className="flex items-center gap-2 px-2 py-2 radius hover:surface-2 focus-ring w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-4 h-4 rounded-[4px] surface-2 bdr" aria-hidden />
        {!collapsed && <span className="flex-1">{label}</span>}
        {!collapsed && <span className="opacity-60">{open ? "▾" : "▸"}</span>}
      </button>

      {!collapsed && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2,0,0,1] }}
              className="ml-2 pl-2 border-l border-[var(--border)] grid gap-1 overflow-hidden"
            >
              {items.map(i => (
                <div key={i} tabIndex={0}
                    className="px-2 py-1 radius hover:surface-2 focus-ring text-[13px]">
                  {i}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
