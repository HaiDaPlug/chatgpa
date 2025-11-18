import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { track } from "@/lib/telemetry";

interface SidebarItemProps {
  to: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsed?: boolean;
  matchPrefix?: boolean; // For prefix matching like /results matching /results/*
}

export function SidebarItem({ to, icon, children, collapsed, matchPrefix = false }: SidebarItemProps) {
  const location = useLocation();

  // Active state logic: exact match OR prefix match
  const isActive = matchPrefix
    ? location.pathname === to || location.pathname.startsWith(to + "/")
    : location.pathname === to;

  function handleClick() {
    track("sidebar_link_clicked", { route: to });
  }

  return (
    <NavLink
      to={to}
      onClick={handleClick}
      aria-current={isActive ? "page" : undefined}
      className="relative block"
      style={{
        transition: "background var(--motion-duration-normal) var(--motion-ease), color var(--motion-duration-normal) var(--motion-ease)",
      }}
    >
      {({ isActive: navLinkActive }) => {
        // Use our custom isActive logic
        const active = isActive;

        return (
          <>
            {/* Active indicator bar */}
            {active && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{
                  background: "var(--accent)",
                  transition: "opacity var(--motion-duration-normal) var(--motion-ease)",
                }}
                aria-hidden="true"
              />
            )}

            {/* Item content */}
            <div
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{
                background: active ? "var(--surface-subtle)" : "transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 500 : 400,
              }}
            >
              {icon && (
                <span
                  className="flex-shrink-0"
                  style={{
                    width: "20px",
                    height: "20px",
                    color: active ? "var(--text)" : "var(--text-soft)",
                    transition: "color var(--motion-duration-normal) var(--motion-ease)",
                  }}
                >
                  {icon}
                </span>
              )}
              {!collapsed && (
                <span
                  className="text-[14px]"
                  style={{
                    transition: "opacity var(--motion-duration-normal) var(--motion-ease)",
                  }}
                >
                  {children}
                </span>
              )}
            </div>
          </>
        );
      }}
    </NavLink>
  );
}
