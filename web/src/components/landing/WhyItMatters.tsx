const reasons = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L13 8L19 9L14.5 13.5L15.5 19.5L10 16.5L4.5 19.5L5.5 13.5L1 9L7 8L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Easy to start',
    description: "No perfect notes required. Paste what you have.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M10 6V10L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Shows knowledge gaps",
    description: 'Stop guessing. See which topics need work.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 10H17M3 5H17M3 15H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Structure from chaos',
    description: 'Random notes become focused questions.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M16.5 10C16.5 13.5899 13.5899 16.5 10 16.5C6.41015 16.5 3.5 13.5899 3.5 10C3.5 6.41015 6.41015 3.5 10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M13 7L17 3M17 3H14M17 3V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Your own pace',
    description: "5 minutes or 5 hours. Pause anytime.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.5 4.5L14 6M6 14L4.5 15.5M15.5 15.5L14 14M6 6L4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    title: 'Real feedback',
    description: 'Understand why you got it wrong. Not just "incorrect."',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 10L8.5 13.5L15 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    title: 'Free to try',
    description: "No credit card. Cancel anytime.",
  },
];

export function WhyItMatters() {
  return (
    <section className="py-20 px-6 bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium text-[var(--accent)] mb-4 tracking-wide uppercase">
            Why ChatGPA
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text)] tracking-tight">
            Study tools shouldn't add stress
          </h2>
        </div>

        {/* Reason Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="p-6 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl hover:border-[var(--accent)]/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] mb-4">
                {reason.icon}
              </div>
              <h3 className="text-base font-semibold text-[var(--text)] mb-2">
                {reason.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {reason.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
