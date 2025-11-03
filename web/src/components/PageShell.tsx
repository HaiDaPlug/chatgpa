import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function PageShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="grid min-h-screen"
      style={{
        gridTemplateColumns: collapsed ? "72px 1fr" : "280px 1fr",
        gridTemplateRows: "56px 1fr",
        gridTemplateAreas: `"sidebar header" "sidebar main"`,
      }}>
      <aside style={{ gridArea: "sidebar" }} className="surface bdr">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      </aside>

      <header style={{ gridArea: "header" }}
              className="surface/70 bdr sticky top-0 z-10">
        <Header />
      </header>

      <main style={{ gridArea: "main" }} className="p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname + location.search}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
