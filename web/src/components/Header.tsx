import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="px-3 py-1.5 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
        onClick={() => setMenuOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        style={{
          color: "var(--text)",
          transition: "background var(--motion-duration-normal) var(--motion-ease)",
        }}
      >
        Profile
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 mt-2 min-w-[180px] z-50 rounded-lg p-2"
          role="menu"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors text-[14px]"
            onClick={() => {
              setMenuOpen(false);
              navigate("/settings/appearance");
            }}
            style={{
              color: "var(--text)",
              transition: "background var(--motion-duration-normal) var(--motion-ease)",
            }}
          >
            Appearance
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors text-[14px]"
            onClick={() => {
              setMenuOpen(false);
              navigate("/billing");
            }}
            style={{
              color: "var(--text)",
              transition: "background var(--motion-duration-normal) var(--motion-ease)",
            }}
          >
            Billing
          </button>
          <div
            className="my-2"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          />
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors text-[14px]"
            onClick={() => {
              setMenuOpen(false);
              handleSignOut();
            }}
            style={{
              color: "var(--text-danger)",
              transition: "background var(--motion-duration-normal) var(--motion-ease)",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
