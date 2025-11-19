import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface AccountMenuProps {
  onOpenAppearance: () => void;
  collapsed?: boolean;
}

export function AccountMenu({ onOpenAppearance, collapsed = false }: AccountMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
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
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Redirect to signin page on success
      navigate("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
      setSignOutError("Unable to sign out. Please try again.");
      setIsSigningOut(false);
    }
  }

  async function handleBilling() {
    setIsRedirecting(true);
    setBillingError(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("/api/v1/billing?action=portal", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to access billing portal");
      }

      const data = await response.json();

      if (data.portal_url) {
        window.location.href = data.portal_url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Billing portal error:", error);
      setBillingError("Unable to access billing. Please try again.");
      setIsRedirecting(false);
      setMenuOpen(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Account Icon Button */}
      <button
        onClick={() => setMenuOpen((s) => !s)}
        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[color:var(--surface-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={isRedirecting || isSigningOut}
        style={{
          transition: "background var(--motion-duration-normal) var(--motion-ease)",
          opacity: isRedirecting || isSigningOut ? 0.6 : 1,
        }}
      >
        {/* Simple user circle icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: "var(--text-muted)", flexShrink: 0 }}
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

        {/* Account text - only show when not collapsed */}
        {!collapsed && (
          <span className="text-[14px] font-medium" style={{ color: "var(--text)" }}>
            Account
          </span>
        )}
      </button>

      {/* Error Messages */}
      {billingError && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 p-3 rounded-lg text-[13px]"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--text-danger)",
            color: "var(--text-danger)",
          }}
        >
          {billingError}
        </div>
      )}
      {signOutError && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 p-3 rounded-lg text-[13px]"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--text-danger)",
            color: "var(--text-danger)",
          }}
        >
          {signOutError}
        </div>
      )}

      {/* Dropdown Menu - Opens UPWARD */}
      {menuOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 min-w-[200px] z-50 rounded-lg p-2"
          role="menu"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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
            disabled={isRedirecting}
            style={{
              color: "var(--text)",
              transition: "background var(--motion-duration-normal) var(--motion-ease)",
              opacity: isRedirecting ? 0.6 : 1,
            }}
          >
            {isRedirecting ? "Redirecting..." : "Billing"}
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
            disabled={isSigningOut || isRedirecting}
            style={{
              color: "var(--text-danger)",
              transition: "background var(--motion-duration-normal) var(--motion-ease)",
              opacity: isSigningOut || isRedirecting ? 0.6 : 1,
            }}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
