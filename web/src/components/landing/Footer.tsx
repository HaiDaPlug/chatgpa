import { Link } from 'react-router-dom';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 px-6 bg-[var(--bg)] border-t border-[var(--border-subtle)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo and tagline */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                  <path d="M12 3L4 7V17L12 21L20 17V7L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 12L4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 12L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 12V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-base font-semibold tracking-tight text-[var(--text)]">
                ChatGPA
              </span>
            </Link>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">
              Study smarter. Stress less.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-8">
            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                Product
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="#how-it-works" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                Legal
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/privacy" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                Contact
              </h4>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:hello@chatgpa.com" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    hello@chatgpa.com
                  </a>
                </li>
                <li>
                  <a href="https://twitter.com/chatgpa" className="text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors">
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-muted)]">
            © {currentYear} ChatGPA. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com/chatgpa"
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              aria-label="Twitter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22 4.01C21 4.5 20.02 4.69 19 5C17.879 3.735 16.217 3.665 15.062 4.5C13.907 5.335 13.351 6.92 13.765 8.39C9.735 8.185 6.267 6.21 4 3C3.5 4 3.3 5.3 4 7C3 6.5 2.5 6.5 2 6.5C2.07 8.64 3.38 10.25 5.5 11C4.5 11.5 4 11.5 3.5 11.5C4 13.5 5.67 14.5 7 15C5.81 16.01 4.005 16.41 2 16C4.241 17.545 6.775 18.185 9.25 17.865C12.004 17.505 14.559 16.1 16.345 13.89C18.129 11.68 18.958 8.965 18.74 6.29C20.037 5.56 21.16 4.49 22 3.12L22 4.01Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
