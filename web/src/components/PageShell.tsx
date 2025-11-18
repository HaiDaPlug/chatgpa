import { ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Breadcrumbs } from "./Breadcrumbs";

const COLLAPSE_KEY = "chatgpa.sidebarCollapsed";

export function PageShell({ children }: { children: ReactNode }) {
  // Load collapse state from localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  // Responsive collapse: auto-collapse on small screens
  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;

      // Auto-collapse below 900px (but don't auto-expand)
      if (width < 900 && !collapsed) {
        setCollapsed(true);
      }
    }

    handleResize(); // Check on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Only run on mount

  // Persist collapse state to localStorage
  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        // Fail silently
      }
      return next;
    });
  }

  // Determine sidebar width based on screen size and collapse state
  const sidebarWidth = collapsed ? "72px" : "280px";

  // Respect reduced motion preference
  const motionPref = document.documentElement.dataset.motion;
  const reducedMotion = motionPref === "reduced";

  return (
    <>
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg"
        style={{
          background: "var(--accent)",
          color: "var(--accent-text)",
          fontWeight: 500,
        }}
      >
        Skip to content
      </a>

      <div
        className="grid min-h-screen"
        style={{
          gridTemplateColumns: `${sidebarWidth} 1fr`,
          gridTemplateRows: "56px 1fr",
          gridTemplateAreas: `"sidebar header" "sidebar main"`,
          transition: reducedMotion
            ? "none"
            : "grid-template-columns var(--motion-duration-normal) var(--motion-ease)",
        }}
      >
        {/* Sidebar */}
        <aside
          style={{ gridArea: "sidebar" }}
          className="surface bdr overflow-hidden"
        >
          <Sidebar collapsed={collapsed} onToggle={handleToggle} />
        </aside>

        {/* Header with Breadcrumbs */}
        <header
          style={{
            gridArea: "header",
            backdropFilter: "saturate(120%) blur(6px)",
          }}
          className="surface/70 bdr sticky top-0 z-10"
        >
          <div className="h-full flex items-center justify-between px-6">
            <Breadcrumbs />
            <Header />
          </div>
        </header>

        {/* Main Content */}
        <main
          id="main-content"
          style={{ gridArea: "main" }}
          className="p-8"
          tabIndex={-1}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname + location.search}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={reducedMotion ? false : { opacity: 1, y: 0 }}
              exit={reducedMotion ? false : { opacity: 0, y: 6 }}
              transition={{
                duration: 0.16,
                ease: [0.2, 0, 0, 1],
              }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
