import { useState } from 'react';

const faqs = [
  {
    question: 'Do I need perfect notes?',
    answer: "No. The AI works with messy or incomplete notes. Paste bullet points or upload PDFs. You don't need to clean anything up first.",
  },
  {
    question: 'Can I use it last-minute?',
    answer: "Yes. If you have 2 hours before an exam, ChatGPA helps you identify what you don't know. It's not a replacement for studying, but it shows where to focus when time is short.",
  },
  {
    question: 'Is my data private?',
    answer: "Yes. Your notes and quiz data are private. We don't share your content or use it to train AI models. You can delete your data anytime.",
  },
  {
    question: "What if I don't like it?",
    answer: "The free plan works with 1 class and 5 quizzes per month—no credit card required. Paid plans can be canceled anytime. No contracts.",
  },
  {
    question: 'What file types work?',
    answer: 'Text and PDFs work now. More formats (Word, PowerPoint) coming soon. If you have notes in Google Docs, copy and paste the text.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 px-6 bg-[var(--surface)]">
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[var(--accent)] mb-4 tracking-wide uppercase">
            FAQ
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text)] tracking-tight">
            Common questions
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[var(--surface)]/50 transition-colors"
              >
                <span className="font-medium text-[var(--text)] pr-4">
                  {faq.question}
                </span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`text-[var(--text-muted)] flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                >
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4">
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12 pt-10 border-t border-[var(--border-subtle)]">
          <p className="text-[var(--text-muted)] mb-3">
            Still have questions?
          </p>
          <a
            href="mailto:hello@chatgpa.com"
            className="text-[var(--accent)] font-medium hover:underline"
          >
            hello@chatgpa.com
          </a>
        </div>
      </div>
    </section>
  );
}
