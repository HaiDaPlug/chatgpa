import { Link } from 'react-router-dom';

const timeline = [
  {
    time: 'Minute 1',
    title: 'Create a class',
    description: 'Name it anything. "Bio Final." "Chapter 7." Whatever.',
  },
  {
    time: 'Minutes 2–3',
    title: 'Add your notes',
    description: 'Paste text or drop a PDF. Formatting doesn\'t matter.',
  },
  {
    time: 'Minute 4',
    title: 'Generate a quiz',
    description: 'Pick question count. Hit generate. Takes about 30 seconds.',
  },
  {
    time: 'Minute 5',
    title: 'See what you don\'t know',
    description: 'Answer at your own pace. Get feedback on each question. Know what to study.',
  },
];

export function FirstSession() {
  return (
    <section id="first-session" className="py-20 px-6 bg-[var(--surface)]">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium text-[var(--accent)] mb-4 tracking-wide uppercase">
            Your first session
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text)] tracking-tight mb-5">
            Your first 5 minutes
          </h2>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto leading-relaxed">
            No tutorials. No wizards. Just add notes and start quizzing.
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-6">
          {timeline.map((item, index) => (
            <div
              key={item.time}
              className="grid md:grid-cols-[120px_1fr] gap-4 md:gap-8 items-start"
            >
              {/* Time */}
              <div className="md:text-right">
                <span className="text-sm font-medium text-[var(--accent)]">
                  {item.time}
                </span>
              </div>

              {/* Content */}
              <div className="relative pb-6 md:pb-0">
                {/* Timeline line */}
                {index < timeline.length - 1 && (
                  <div className="hidden md:block absolute left-[-2rem] top-6 bottom-[-1.5rem] w-px bg-[var(--border-subtle)]" />
                )}
                {/* Timeline dot */}
                <div className="hidden md:block absolute left-[-2rem] top-1.5 w-2 h-2 -translate-x-1/2 rounded-full bg-[var(--accent)]" />

                <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                    {item.title}
                  </h3>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 pt-10 border-t border-[var(--border-subtle)]">
          <p className="text-lg text-[var(--text)] mb-6">
            Ready to see what you actually know?
          </p>
          <Link
            to="/signin"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all"
          >
            Start for free
            <svg className="ml-2 w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
