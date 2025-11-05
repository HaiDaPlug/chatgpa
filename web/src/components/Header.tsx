import { Link, useNavigate } from "react-router-dom";
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
    <div
      className="h-14 flex items-center justify-between px-6"
      style={{ backdropFilter: "saturate(120%) blur(6px)" }}
    >
      {/* Logo / Home Link */}
      <Link to="/dashboard" className="flex items-center gap-2 select-none hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 radius surface-2 bdr flex items-center justify-center text-[14px] font-semibold">
          G
        </div>
        <span className="text-[16px] font-semibold">ChatGPA</span>
      </Link>

      {/* Profile Dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          className="btn ghost"
          onClick={() => setMenuOpen(s => !s)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          Profile
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-2 surface bdr radius shadow p-2 min-w-[180px] z-50"
            role="menu"
            style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
          >
            <button
              className="w-full text-left px-3 py-2 radius hover:surface-2 transition-colors text-[14px]"
              onClick={() => {
                setMenuOpen(false);
                navigate("/profile");
              }}
            >
              Profile
            </button>
            <button
              className="w-full text-left px-3 py-2 radius hover:surface-2 transition-colors text-[14px]"
              onClick={() => {
                setMenuOpen(false);
                navigate("/settings");
              }}
            >
              Settings
            </button>
            <div className="my-2" style={{ borderTop: "1px solid var(--border)" }} />
            <button
              className="w-full text-left px-3 py-2 radius hover:surface-2 transition-colors text-[14px]"
              onClick={() => {
                setMenuOpen(false);
                handleSignOut();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
