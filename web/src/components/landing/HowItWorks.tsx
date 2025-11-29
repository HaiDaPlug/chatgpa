import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Add your notes',
    description: "Paste text or upload PDFs. Messy notes are fine—we work with what you have.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 18V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Generate quizzes',
    description: 'AI reads your material and creates questions covering key concepts. Pick your topic and question count.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    number: '03',
    title: "See what you don't know",
    description: 'Answer questions and get instant feedback. Know exactly which topics need work.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--accent)]">
        <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium text-[var(--accent)] mb-4 tracking-wide uppercase">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text)] tracking-tight">
            Three steps. That's it.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl p-6 h-full hover:border-[var(--accent)]/30 transition-colors">
                {/* Icon and number */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <span className="text-4xl font-bold text-[var(--border-subtle)]">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
                  {step.title}
                </h3>
                <p className="text-[var(--text-muted)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-[var(--text-muted)] mb-5">
            No complex setup. No learning curve.
          </p>
          <Link to="/signin" className="inline-flex items-center text-[var(--accent)] font-medium hover:underline">
            Try it now
            <svg className="ml-1 w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
