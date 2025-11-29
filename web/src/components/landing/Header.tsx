import { useState } from 'react';
import { Link } from 'react-router-dom';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/95 backdrop-blur-sm border-b border-[var(--border-subtle)]">
      <nav className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                <path d="M12 3L4 7V17L12 21L20 17V7L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 12L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 12L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 12V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
              ChatGPA
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              How it works
            </a>
            <a href="#pricing" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              FAQ
            </a>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/signin" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              Sign in
            </Link>
            <Link to="/signin" className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity">
              Get started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              ) : (
                <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-2 border-t border-[var(--border-subtle)] mt-4">
            <div className="flex flex-col gap-4">
              <a
                href="#how-it-works"
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it works
              </a>
              <a
                href="#pricing"
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
              <hr className="border-[var(--border-subtle)]" />
              <Link to="/signin" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                Sign in
              </Link>
              <Link to="/signin" className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-lg text-center hover:opacity-90 transition-opacity">
                Get started
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
