import { ReactNode, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
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

  // Appearance modal state
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

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

  // ESC key handler for appearance modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && appearanceOpen) {
        setAppearanceOpen(false);
      }
    }

    if (appearanceOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [appearanceOpen]);

  // Focus management and body scroll lock for modal
  useEffect(() => {
    if (appearanceOpen) {
      // Save current focus
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus modal
      modalRef.current?.focus();

      // Prevent body scroll
      document.body.style.overflow = "hidden";

      return () => {
        // Restore body scroll
        document.body.style.overflow = "";

        // Restore focus
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [appearanceOpen]);

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
        className="grid h-screen overflow-hidden"
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
          className="surface bdr overflow-hidden min-h-0"
        >
          <Sidebar
            collapsed={collapsed}
            onToggle={handleToggle}
            onOpenAppearance={() => setAppearanceOpen(true)}
          />
        </aside>

        {/* Header with Breadcrumbs */}
        <header
          style={{
            gridArea: "header",
            backdropFilter: "saturate(120%) blur(6px)",
          }}
          className="surface/70 bdr z-10"
        >
          <div className="h-full flex items-center px-6">
            <Breadcrumbs />
          </div>
        </header>

        {/* Main Content */}
        <main
          id="main-content"
          style={{ gridArea: "main" }}
          className="p-8 min-h-0 overflow-y-auto"
          tabIndex={-1}
        >
          <AnimatePresence mode="wait">
            <motion.div
              // ✅ Safe: Prevent remount on query-string changes like ?attempt=...
              // ⚠️ Verify: Ensure page transitions still animate on pathname changes as intended.
              key={location.pathname}
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

      {/* Appearance Settings Modal */}
      <AnimatePresence>
        {appearanceOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--overlay)" }}
            onClick={() => setAppearanceOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="appearance-modal-title"
              tabIndex={-1}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reducedMotion ? false : { opacity: 1, scale: 1, y: 0 }}
              exit={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 4 }}
              transition={{
                duration: 0.18,
                ease: [0.2, 0, 0, 1],
              }}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl p-8"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {/* Close button */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setAppearanceOpen(false)}
                className="p-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors"
                style={{
                  color: "var(--text-muted)",
                  transition: "background var(--motion-duration-normal) var(--motion-ease)",
                }}
                aria-label="Close appearance settings"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 5L15 15M5 15L15 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* Settings Panel */}
            <AppearanceSettingsPanel />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
