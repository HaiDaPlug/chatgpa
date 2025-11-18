import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface AccountMenuProps {
  onOpenAppearance: () => void;
}

export function AccountMenu({ onOpenAppearance }: AccountMenuProps) {
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

  async function handleBilling() {
    setMenuOpen(false);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        console.error("No auth token for billing");
        return;
      }

      const response = await fetch("/api/v1/billing?action=portal", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.portal_url) {
        window.location.href = data.portal_url;
      } else {
        console.error("No portal URL returned");
      }
    } catch (error) {
      console.error("Billing portal error:", error);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Account Icon Button */}
      <button
        onClick={() => setMenuOpen((s) => !s)}
        className="p-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        style={{
          transition: "background var(--motion-duration-normal) var(--motion-ease)",
        }}
      >
        {/* Simple user circle icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: "var(--text-muted)" }}
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6.5 18.5C7.5 16.5 9.5 15 12 15C14.5 15 16.5 16.5 17.5 18.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          className="absolute right-0 mt-2 min-w-[200px] z-50 rounded-lg p-2"
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
              onOpenAppearance();
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
            onClick={handleBilling}
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
