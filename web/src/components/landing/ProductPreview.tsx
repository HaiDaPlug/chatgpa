export function ProductPreview() {
  return (
    <section id="demo" className="py-20 px-6 bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium text-[var(--accent)] mb-4 tracking-wide uppercase">
            Product vision
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text)] tracking-tight mb-5">
            Where we're headed
          </h2>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto leading-relaxed">
            This preview shows our north star. Some features are live. Others are in development.
          </p>
        </div>

        {/* Product Preview */}
        <div className="relative">
          {/* Main Preview Container */}
          <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-xl shadow-xl overflow-hidden">
            {/* App Chrome */}
            <div className="bg-[var(--surface)] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                  <div className="w-3 h-3 rounded-full bg-[var(--border-subtle)]" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[var(--accent)]/10 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--accent)]">
                      <path d="M6 1.5L2 3.5V8.5L6 10.5L10 8.5V3.5L6 1.5Z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-[var(--text)]">ChatGPA</span>
                </div>
              </div>
              <div className="text-xs text-[var(--text-muted)]">Biology 101 — Cell Biology</div>
            </div>

            {/* App Content */}
            <div className="grid md:grid-cols-[280px_1fr] min-h-[480px]">
              {/* Sidebar */}
              <div className="border-r border-[var(--border-subtle)] p-4 hidden md:block">
                <div className="mb-6">
                  <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                    Your Notes
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--accent)]">
                          <path d="M8 1H4C3.44772 1 3 1.44772 3 2V12C3 12.5523 3.44772 13 4 13H10C10.5523 13 11 12.5523 11 12V4L8 1Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        <span className="text-sm text-[var(--text)]">Chapter 4 Notes</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">2,340 words • 8 topics</span>
                    </div>
                    <div className="p-3 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg opacity-60">
                      <div className="flex items-center gap-2 mb-1">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--text-muted)]">
                          <path d="M8 1H4C3.44772 1 3 1.44772 3 2V12C3 12.5523 3.44772 13 4 13H10C10.5523 13 11 12.5523 11 12V4L8 1Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        <span className="text-sm text-[var(--text)]">Lecture Slides</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">PDF • 24 slides</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                    Progress
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-[var(--text)]">Cell Structure</span>
                        <span className="text-[var(--accent)]">85%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div className="h-full w-[85%] bg-[var(--accent)] rounded-full" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-[var(--text)]">Cell Membrane</span>
                        <span className="text-[var(--text-warning)]">60%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div className="h-full w-[60%] bg-[var(--text-warning)] rounded-full" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-[var(--text)]">ATP Synthesis</span>
                        <span className="text-[var(--score-fail)]">35%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div className="h-full w-[35%] bg-[var(--score-fail)] rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-6">
                {/* Question Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent)] text-sm font-medium rounded-full">
                      Question 7 of 12
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">ATP Synthesis</span>
                  </div>
                  <button className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                    Skip →
                  </button>
                </div>

                {/* Question */}
                <div className="mb-8">
                  <h3 className="text-xl font-medium text-[var(--text)] mb-6">
                    During which stage of cellular respiration is the most ATP produced?
                  </h3>

                  {/* Answer Options */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] cursor-pointer group">
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] group-hover:border-[var(--accent)] transition-colors" />
                      <span className="text-[var(--text)]">Glycolysis</span>
                    </label>
                    <label className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] cursor-pointer group">
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] group-hover:border-[var(--accent)] transition-colors" />
                      <span className="text-[var(--text)]">Krebs Cycle</span>
                    </label>
                    <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-[var(--accent)] bg-[var(--accent)]/5 cursor-pointer">
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--accent)] bg-[var(--accent)] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                      <span className="text-[var(--text)] font-medium">Electron Transport Chain</span>
                    </label>
                    <label className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] cursor-pointer group">
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--border-subtle)] group-hover:border-[var(--accent)] transition-colors" />
                      <span className="text-[var(--text)]">Fermentation</span>
                    </label>
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center justify-between">
                  <button className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                    ← Previous
                  </button>
                  <button className="px-6 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
                    Check Answer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Annotations */}
          <div className="hidden lg:block absolute -left-4 top-32 bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg px-4 py-3 shadow-lg max-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--text)]">Note organization</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Coming soon: Topic-based organization
            </p>
          </div>

          <div className="hidden lg:block absolute -right-4 top-24 bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg px-4 py-3 shadow-lg max-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--text)]">Smart questions</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Generated from your notes
            </p>
          </div>

          <div className="hidden lg:block absolute -left-4 bottom-24 bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg px-4 py-3 shadow-lg max-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[var(--text-warning)]" />
              <span className="text-xs font-medium text-[var(--text)]">Progress tracking</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              In development: Per-topic scoring
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
