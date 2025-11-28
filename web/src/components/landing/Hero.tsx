import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-6 relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[var(--surface)] opacity-50" />

      <div className="max-w-6xl mx-auto relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-semibold leading-[1.1] tracking-tight text-[var(--text)] mb-6">
              Studying sucks. Let's make it easier.
            </h1>
            <p className="text-lg text-[var(--text-muted)] leading-relaxed mb-10">
              Turn messy notes into focused quizzes.
              See exactly what you don't know yet.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Link
                to="/signin"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-sm"
              >
                Get started free
                <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-[var(--text)] bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--border-subtle)]/50 transition-colors"
              >
                <svg className="mr-2 w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6.5 5.5L11 8L6.5 10.5V5.5Z" fill="currentColor"/>
                </svg>
                Watch how it works
              </a>
            </div>

            {/* Microcopy */}
            <p className="text-sm text-[var(--text-muted)]">
              Free to start. No credit card required.
            </p>
          </div>

          {/* Right: Product Mock */}
          <div className="relative">
            <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg overflow-hidden">
              {/* Mock App Header */}
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-1 bg-[var(--bg)] rounded-md text-xs text-[var(--text-muted)]">
                    ChatGPA — Biology 101
                  </div>
                </div>
              </div>

              {/* Mock Content */}
              <div className="p-6">
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-medium">✓</span>
                    <span>Notes added</span>
                  </div>
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-medium">2</span>
                    <span className="font-medium">Quiz ready</span>
                  </div>
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="w-5 h-5 rounded-full bg-[var(--surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px]">3</span>
                    <span>Review</span>
                  </div>
                </div>

                {/* Quiz Question Card */}
                <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg p-5 mb-4">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-xs font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded">
                      Question 3 of 12
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">Cell Biology</span>
                  </div>
                  <p className="text-[var(--text)] font-medium mb-4">
                    What is the primary function of mitochondria in a cell?
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-subtle)] cursor-pointer">
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--border-subtle)]" />
                      <span className="text-sm text-[var(--text)]">Protein synthesis</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/5 cursor-pointer">
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      <span className="text-sm text-[var(--text)]">ATP production</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-subtle)] cursor-pointer">
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--border-subtle)]" />
                      <span className="text-sm text-[var(--text)]">DNA replication</span>
                    </label>
                  </div>
                </div>

                {/* Action */}
                <button className="w-full py-2.5 px-4 bg-[var(--accent)] text-white text-sm font-medium rounded-lg">
                  Check Answer
                </button>
              </div>
            </div>

            {/* Floating annotation */}
            <div className="absolute -right-4 top-1/4 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 shadow-md hidden lg:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--score-pass)]" />
              <span className="text-xs text-[var(--text-muted)]">Generated from your notes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
