import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { SidebarItem } from "./SidebarItem";
import { track } from "@/lib/telemetry";

type ClassRow = { id: string; name: string };

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [classesExpanded, setClassesExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  // Load user's classes
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingClasses(true);
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .order("created_at", { ascending: false });

      if (!alive) return;

      if (error) {
        console.error("SIDEBAR_CLASSES_ERROR", error);
        setClasses([]);
      } else {
        setClasses(data ?? []);
      }
      setLoadingClasses(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Keyboard navigation
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

    e.preventDefault();
    const navItems = navRef.current?.querySelectorAll('a[href], button[role="button"]');
    if (!navItems || navItems.length === 0) return;

    const activeElement = document.activeElement;
    const currentIndex = Array.from(navItems).indexOf(activeElement as HTMLElement);

    let nextIndex = 0;
    if (e.key === "ArrowDown") {
      nextIndex = currentIndex + 1 >= navItems.length ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex - 1 < 0 ? navItems.length - 1 : currentIndex - 1;
    }

    (navItems[nextIndex] as HTMLElement)?.focus();
  }

  function handleLogoClick() {
    track("sidebar_logo_clicked", { route: "/dashboard" });
    navigate("/dashboard");
  }

  function handleToggleClick() {
    track("sidebar_toggle", { state: collapsed ? "expanded" : "collapsed" });
    onToggle();
  }

  return (
    <div
      className="h-full flex flex-col p-4"
      role="navigation"
      aria-label="Main navigation"
      ref={navRef}
      onKeyDown={handleKeyDown}
    >
      {/* Logo / Title */}
      <div className="flex items-center justify-between mb-6">
        {!collapsed && (
          <button
            onClick={handleLogoClick}
            className="text-[18px] font-semibold m-0 hover:opacity-80 transition-opacity"
            style={{
              color: "var(--text)",
              transition: "opacity var(--motion-duration-normal) var(--motion-ease)",
            }}
          >
            ChatGPA
          </button>
        )}
        <button
          onClick={handleToggleClick}
          className="p-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors focus-ring"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          style={{
            transition: "background var(--motion-duration-normal) var(--motion-ease)",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "14px" }}>
            {collapsed ? "→" : "←"}
          </span>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {/* Dashboard */}
        <div className="mb-6">
          <SidebarItem to="/dashboard" collapsed={collapsed}>
            Dashboard
          </SidebarItem>
        </div>

        {/* Study Tools */}
        <div className="mb-6">
          {!collapsed && (
            <div
              className="px-3 pt-4 pb-1 text-xs uppercase tracking-wide"
              style={{
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              Study Tools
            </div>
          )}
          <div className="space-y-1">
            <SidebarItem to="/tools/generate" collapsed={collapsed}>
              Generate Quiz
            </SidebarItem>
            <SidebarItem to="/results" collapsed={collapsed} matchPrefix>
              Results
            </SidebarItem>
          </div>
        </div>

        {/* Classes */}
        <div className="mb-6">
          {!collapsed && (
            <div
              className="px-3 pt-4 pb-1 text-xs uppercase tracking-wide"
              style={{
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              Classes
            </div>
          )}

          {/* All Classes Link */}
          <SidebarItem to="/dashboard" collapsed={collapsed}>
            All Classes
          </SidebarItem>

          {/* Dynamic Class List */}
          {!collapsed && (
            <AnimatePresence initial={false}>
              {classesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    duration: 0.18,
                    ease: [0.2, 0, 0, 1],
                  }}
                  className="ml-4 mt-1 overflow-hidden"
                >
                  {loadingClasses && (
                    <div
                      className="px-3 py-2 text-[13px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Loading classes...
                    </div>
                  )}

                  {!loadingClasses && classes.length === 0 && (
                    <div
                      className="px-3 py-2 text-[13px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No classes yet
                    </div>
                  )}

                  {!loadingClasses &&
                    classes.map((c) => {
                      const isActive = location.pathname.startsWith(`/classes/${c.id}`);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            track("sidebar_link_clicked", { route: `/classes/${c.id}/notes` });
                            navigate(`/classes/${c.id}/notes`);
                          }}
                          aria-current={isActive ? "page" : undefined}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition-colors focus-ring"
                          style={{
                            background: isActive ? "var(--surface-subtle)" : "transparent",
                            color: isActive ? "var(--text)" : "var(--text-muted)",
                            fontWeight: isActive ? 500 : 400,
                            transition: "background var(--motion-duration-normal) var(--motion-ease), color var(--motion-duration-normal) var(--motion-ease)",
                          }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Account */}
        <div className="mb-6">
          {!collapsed && (
            <div
              className="px-3 pt-4 pb-1 text-xs uppercase tracking-wide"
              style={{
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              Account
            </div>
          )}
          <div className="space-y-1">
            <SidebarItem to="/settings/appearance" collapsed={collapsed}>
              Appearance
            </SidebarItem>
            <SidebarItem to="/billing" collapsed={collapsed}>
              Billing
            </SidebarItem>
          </div>
        </div>
      </nav>
    </div>
  );
}
