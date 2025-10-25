import { Link, NavLink, Outlet } from "react-router-dom";
import { RequireAuth } from "@/lib/authGuard";

export default function AppLayout() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link to="/dashboard" className="text-lg font-semibold tracking-tight">ChatGPA</Link>
            <nav className="flex items-center gap-2 text-sm">
              <Tab to="/dashboard" label="Dashboard" />
              <Tab to="/generate" label="Generate" />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 transition ${isActive ? "bg-stone-800 text-white" : "text-stone-300 hover:text-white"}`
      }
    >
      {label}
    </NavLink>
  );
}
