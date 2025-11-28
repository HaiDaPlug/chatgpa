import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Free',
    description: 'Try it out with one class',
    price: '$0',
    period: 'forever',
    features: [
      '1 class',
      '5 quizzes per month',
      'Basic question types',
      'Progress tracking',
    ],
    cta: 'Get started',
    featured: false,
  },
  {
    name: 'Monthly',
    description: 'Full access, billed monthly',
    price: '$9',
    period: '/month',
    features: [
      'Unlimited classes',
      'Unlimited quizzes',
      'All question types',
      'Detailed feedback',
      'Export to PDF (coming soon)',
      'Priority support',
    ],
    cta: 'Start free trial',
    featured: true,
  },
  {
    name: 'Annual',
    description: 'Best value for the year',
    price: '$6',
    period: '/month',
    annualPrice: '$72/year',
    savings: 'Save $36',
    features: [
      'Everything in Monthly',
      '2 months free',
      'Early access to new features',
      'Study group sharing (roadmap)',
    ],
    cta: 'Start free trial',
    featured: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 px-6 bg-[var(--bg)]">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[var(--accent)] mb-4 tracking-wide uppercase">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text)] tracking-tight mb-5">
            Start free. Upgrade when ready.
          </h2>
          <p className="text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
            No pressure. No hidden fees. Free plan is actually useful.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-6 ${
                plan.featured
                  ? 'border-[var(--accent)] bg-[var(--surface)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface)]'
              }`}
            >
              {/* Popular badge */}
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-[var(--accent)] text-white text-xs font-medium rounded-full">
                    Most popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[var(--text)] mb-1">
                  {plan.name}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[var(--text)]">
                    {plan.price}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    {plan.period}
                  </span>
                </div>
                {plan.annualPrice && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-[var(--text-muted)]">
                      {plan.annualPrice}
                    </span>
                    <span className="text-xs font-medium text-[var(--score-pass)] bg-[var(--score-pass)]/10 px-2 py-0.5 rounded">
                      {plan.savings}
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      className="text-[var(--accent)] mt-0.5 flex-shrink-0"
                    >
                      <path
                        d="M4.5 9L7.5 12L13.5 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-sm text-[var(--text)]">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to="/signin"
                className={`block w-full py-2.5 px-4 text-center text-sm font-medium rounded-lg transition-all ${
                  plan.featured
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'bg-[var(--bg)] border border-[var(--border-subtle)] text-[var(--text)] hover:bg-[var(--border-subtle)]/50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="text-center mt-10">
          <p className="text-sm text-[var(--text-muted)]">
            All paid plans include a 7-day free trial. Cancel anytime.
          </p>
        </div>
      </div>
    </section>
  );
}
