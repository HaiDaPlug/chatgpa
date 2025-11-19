// Purpose: ChatGPA landing page - public marketing page
// Connects to: App.tsx routing, /signin page

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Landing() {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      {/* Header */}
      <header
        className="border-b"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--bg)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center">
            <h1
              className="text-xl font-bold tracking-tight"
              style={{
                color: "var(--text)",
              }}
            >
              ChatGPA
            </h1>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-6">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-sm transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              Product
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-sm transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              Pricing
            </button>
            <button
              onClick={() => navigate("/signin")}
              className="text-sm px-4 py-2 rounded-md border transition-all"
              style={{
                color: "var(--text)",
                borderColor: "var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-subtle)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Sign in
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.18,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-soft)" }}
            >
              Study with AI, not chaos.
            </p>
            <h2
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 tracking-tight"
              style={{
                color: "var(--text)",
                lineHeight: 1.1,
              }}
            >
              Turn your messy notes into targeted quizzes.
            </h2>
            <p
              className="text-lg mb-8"
              style={{ color: "var(--text-muted)" }}
            >
              ChatGPA helps you upload your notes, generate smart quizzes, and get feedback on what you actually don't know yet.
            </p>

            {/* CTA */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/signin")}
                className="px-6 py-3 rounded-md font-medium text-base transition-all focus:outline-none active:scale-[0.98]"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-strong)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(91,122,230,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.1)";
                }}
              >
                Get started
              </button>
              <p className="text-sm" style={{ color: "var(--text-soft)" }}>
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/signin")}
                  className="underline transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  Sign in
                </button>
              </p>
            </div>
          </motion.div>

          {/* Right: Visual placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.18,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.1,
            }}
            className="rounded-xl p-6 md:p-8"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* TODO: Replace with Canva export */}
            {/* <img src="/landing/hero.png" alt="ChatGPA demo" /> */}
            {/* <video src="/landing/hero.mp4" autoPlay loop muted /> */}

            {/* Placeholder: Mini quiz UI mockup */}
            <div className="space-y-4">
              <div>
                <p
                  className="text-sm font-medium mb-3"
                  style={{ color: "var(--text)" }}
                >
                  What is the main purpose of mitochondria in cells?
                </p>
                <div className="space-y-2">
                  {["Energy production", "Protein synthesis", "DNA storage", "Waste removal"].map((option, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-md text-sm transition-all"
                      style={{
                        background: i === 0 ? "var(--accent-soft)" : "var(--surface-subtle)",
                        border: `1px solid ${i === 0 ? "var(--accent)" : "var(--border-subtle)"}`,
                        color: "var(--text)",
                      }}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="text-xs p-3 rounded-md"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--text-muted)",
                }}
              >
                ✓ Your answer demonstrates understanding of cellular respiration.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-16"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <h3
          className="text-2xl md:text-3xl font-bold text-center mb-12 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          How ChatGPA works
        </h3>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "1",
              title: "Upload your notes",
              description: "Paste text or upload files from your classes, in any order.",
            },
            {
              step: "2",
              title: "Generate smart quizzes",
              description: "AI creates tailored questions based on what's actually in your notes.",
            },
            {
              step: "3",
              title: "Get feedback on your answers",
              description: "ChatGPA grades your responses and shows what to focus on next.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-6 rounded-lg transition-all"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mb-4"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                {item.step}
              </div>
              <h4
                className="text-lg font-semibold mb-2"
                style={{ color: "var(--text)" }}
              >
                {item.title}
              </h4>
              <p
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why students use ChatGPA */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-16">
        <h3
          className="text-2xl md:text-3xl font-bold text-center mb-12 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          Why students actually use this
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            "Start studying in 2 minutes, not 2 hours of organizing notes.",
            "Get instant feedback that actually tells you what's missing.",
            "Stop guessing what to review the night before an exam.",
            "Keep track of quiz attempts and see your progress over time.",
          ].map((benefit, i) => (
            <div key={i} className="flex gap-3">
              <div
                className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                style={{ background: "var(--text-soft)" }}
              />
              <p
                className="text-base"
                style={{ color: "var(--text)" }}
              >
                {benefit}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-16">
        <h3
          className="text-2xl md:text-3xl font-bold text-center mb-12 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          Who it's for
        </h3>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              persona: "The Procrastinator",
              description: "Exam in a week? Upload your notes and we'll highlight what you don't know yet.",
            },
            {
              persona: "The Exhausted Student",
              description: "Already working hard? Let ChatGPA generate quizzes so you can focus on learning.",
            },
            {
              persona: "The Crammer",
              description: "Need to triage fast in the last 2–3 days? Use quick quizzes to find the gaps.",
            },
          ].map((item) => (
            <div
              key={item.persona}
              className="p-6 rounded-lg"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <h4
                className="text-lg font-semibold mb-3"
                style={{ color: "var(--text)" }}
              >
                {item.persona}
              </h4>
              <p
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing placeholder */}
      <section
        id="pricing"
        className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-16"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <h3
          className="text-2xl md:text-3xl font-bold text-center mb-6 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          Simple pricing
        </h3>
        <p
          className="text-center mb-12"
          style={{ color: "var(--text-muted)" }}
        >
          Start free. Upgrade when you need more.
        </p>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              name: "Free",
              price: "$0",
              features: ["1 class", "5 quizzes total", "Basic grading"],
            },
            {
              name: "Monthly Pro",
              price: "$9",
              period: "/mo",
              features: ["Unlimited classes", "Unlimited quizzes", "Advanced grading"],
              highlight: true,
            },
            {
              name: "Annual Pro",
              price: "$79",
              period: "/yr",
              features: ["Everything in Monthly", "Save $29/year", "Priority support"],
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className="p-6 rounded-xl transition-all"
              style={{
                background: "var(--surface)",
                border: plan.highlight
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border-subtle)",
              }}
            >
              {plan.highlight && (
                <div
                  className="text-xs font-semibold mb-2 inline-block px-2 py-1 rounded"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  POPULAR
                </div>
              )}
              <h4
                className="text-lg font-semibold mb-2"
                style={{ color: "var(--text)" }}
              >
                {plan.name}
              </h4>
              <div className="mb-4">
                <span
                  className="text-3xl font-bold"
                  style={{ color: plan.highlight ? "var(--accent)" : "var(--text)" }}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span
                    className="text-lg"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {plan.period}
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span style={{ color: plan.highlight ? "var(--accent)" : "var(--text-soft)" }}>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mt-20"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p
              className="text-sm"
              style={{ color: "var(--text-soft)" }}
            >
              © {new Date().getFullYear()} ChatGPA. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a
                href="#"
                className="text-sm transition-colors"
                style={{ color: "var(--text-soft)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-soft)")}
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-sm transition-colors"
                style={{ color: "var(--text-soft)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-soft)")}
              >
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
