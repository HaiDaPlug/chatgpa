import { Link } from "react-router-dom";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">ChatGPA</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/generate" className="hover:text-coral-300 transition">Try it</Link>
            <Link to="/dashboard" className="rounded-xl bg-coral-500 px-4 py-2 font-medium text-white hover:bg-coral-400 transition">
              Open app
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-stone-800">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-stone-400">
          © {new Date().getFullYear()} ChatGPA. Study faster, stress less.
        </div>
      </footer>
    </div>
  );
}
