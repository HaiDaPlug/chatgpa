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
          <nav className="flex items-center gap-8">
            <button
              onClick={() => scrollToSection("how-it-works")}
              className="text-sm font-medium transition-all duration-150"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Product
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-sm font-medium transition-all duration-150"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Pricing
            </button>
            <button
              onClick={() => navigate("/signin")}
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-all duration-200"
              style={{
                color: "var(--text)",
                borderColor: "var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-subtle)";
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Sign in
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.24,
              ease: [0.4, 0, 0.2, 1],
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.1 }}
              className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-6"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              Study with AI, not chaos
            </motion.div>
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight"
              style={{
                color: "var(--text)",
                lineHeight: 1.05,
              }}
            >
              Turn your messy notes into targeted quizzes.
            </h2>
            <p
              className="text-lg md:text-xl mb-10 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              ChatGPA helps you upload your notes, generate smart quizzes, and get feedback on what you actually don't know yet.
            </p>

            {/* CTA */}
            <div className="flex flex-col gap-4">
              <button
                onClick={() => navigate("/signin")}
                className="px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 focus:outline-none active:scale-[0.97] inline-flex items-center justify-center gap-2 group"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  boxShadow: "0 2px 8px rgba(91,122,230,0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-strong)";
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(91,122,230,0.4)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(91,122,230,0.25)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Get started free
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </button>
              <p className="text-sm" style={{ color: "var(--text-soft)" }}>
                Already have an account?{" "}
                <button
                  onClick={() => navigate("/signin")}
                  className="font-medium transition-colors duration-150"
                  style={{ color: "var(--accent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-strong)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent)")}
                >
                  Sign in
                </button>
              </p>
            </div>
          </motion.div>

          {/* Right: Visual placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.24,
              ease: [0.4, 0, 0.2, 1],
              delay: 0.15,
            }}
            className="relative"
          >
            {/* Ambient glow */}
            <div
              className="absolute inset-0 rounded-2xl opacity-50 blur-3xl"
              style={{
                background: "radial-gradient(circle at 50% 50%, var(--accent), transparent 70%)",
              }}
            />

            {/* Quiz mockup card */}
            <div
              className="relative rounded-2xl p-6 md:p-8 backdrop-blur-sm"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              {/* TODO: Replace with Canva export */}
              {/* <img src="/landing/hero.png" alt="ChatGPA demo" className="rounded-xl" /> */}
              {/* <video src="/landing/hero.mp4" autoPlay loop muted className="rounded-xl" /> */}

              {/* Animated quiz UI mockup */}
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <p
                    className="text-sm font-semibold mb-4"
                    style={{ color: "var(--text)" }}
                  >
                    What is the main purpose of mitochondria in cells?
                  </p>
                  <div className="space-y-2.5">
                    {["Energy production", "Protein synthesis", "DNA storage", "Waste removal"].map((option, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.08, duration: 0.2 }}
                        className="px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                        style={{
                          background: i === 0 ? "var(--accent-soft)" : "var(--surface-subtle)",
                          border: `1.5px solid ${i === 0 ? "var(--accent)" : "var(--border-subtle)"}`,
                          color: "var(--text)",
                        }}
                        onMouseEnter={(e) => {
                          if (i !== 0) {
                            e.currentTarget.style.borderColor = "var(--border-strong)";
                            e.currentTarget.style.transform = "translateX(2px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (i !== 0) {
                            e.currentTarget.style.borderColor = "var(--border-subtle)";
                            e.currentTarget.style.transform = "translateX(0)";
                          }
                        }}
                      >
                        {option}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.3 }}
                  className="text-xs p-4 rounded-lg flex items-start gap-2"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--accent)",
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>✓</span>
                  <span>Your answer demonstrates understanding of cellular respiration.</span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-24 md:py-32"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <h3
          className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          How ChatGPA works
        </h3>

        <div className="grid md:grid-cols-3 gap-8">
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
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.24, delay: parseInt(item.step) * 0.1 }}
              className="p-8 rounded-xl transition-all duration-200"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-full text-base font-bold mb-5"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                {item.step}
              </div>
              <h4
                className="text-xl font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                {item.title}
              </h4>
              <p
                className="text-base leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why students use ChatGPA */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-24 md:py-32">
        <h3
          className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          Why students actually use this
        </h3>

        <div className="grid md:grid-cols-2 gap-8">
          {[
            "Start studying in 2 minutes, not 2 hours of organizing notes.",
            "Get instant feedback that actually tells you what's missing.",
            "Stop guessing what to review the night before an exam.",
            "Keep track of quiz attempts and see your progress over time.",
          ].map((benefit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.24, delay: i * 0.08 }}
              className="flex gap-4 p-6 rounded-xl transition-all duration-200"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.transform = "translateX(4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                ✓
              </div>
              <p
                className="text-lg leading-relaxed"
                style={{ color: "var(--text)" }}
              >
                {benefit}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-24 md:py-32">
        <h3
          className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          Who it's for
        </h3>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              persona: "The Procrastinator",
              emoji: "⏰",
              description: "Exam in a week? Upload your notes and we'll highlight what you don't know yet.",
            },
            {
              persona: "The Exhausted Student",
              emoji: "😮‍💨",
              description: "Already working hard? Let ChatGPA generate quizzes so you can focus on learning.",
            },
            {
              persona: "The Crammer",
              emoji: "📚",
              description: "Need to triage fast in the last 2–3 days? Use quick quizzes to find the gaps.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.persona}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.24, delay: i * 0.1 }}
              className="p-8 rounded-xl transition-all duration-200"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div className="text-3xl mb-4">{item.emoji}</div>
              <h4
                className="text-xl font-bold mb-3"
                style={{ color: "var(--text)" }}
              >
                {item.persona}
              </h4>
              <p
                className="text-base leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-24 md:py-32"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <h3
          className="text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight"
          style={{
            color: "var(--text)",
          }}
        >
          Simple pricing
        </h3>
        <p
          className="text-center mb-16 text-lg"
          style={{ color: "var(--text-muted)" }}
        >
          Start free. Upgrade when you need more.
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
          ].map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.24, delay: i * 0.1 }}
              className="p-8 rounded-2xl transition-all duration-200 flex flex-col"
              style={{
                background: "var(--surface)",
                border: plan.highlight
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border-subtle)",
                transform: plan.highlight ? "scale(1.05)" : "scale(1)",
              }}
              onMouseEnter={(e) => {
                if (!plan.highlight) {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";
                } else {
                  e.currentTarget.style.transform = "translateY(-4px) scale(1.05)";
                  e.currentTarget.style.boxShadow = "0 12px 32px rgba(91,122,230,0.2)";
                }
              }}
              onMouseLeave={(e) => {
                if (!plan.highlight) {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.boxShadow = "none";
                } else {
                  e.currentTarget.style.transform = "translateY(0) scale(1.05)";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              {plan.highlight && (
                <div
                  className="text-xs font-bold mb-4 inline-block px-3 py-1.5 rounded-full self-start"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                  }}
                >
                  POPULAR
                </div>
              )}
              <h4
                className="text-xl font-bold mb-2"
                style={{ color: "var(--text)" }}
              >
                {plan.name}
              </h4>
              <div className="mb-6">
                <span
                  className="text-4xl font-bold"
                  style={{ color: plan.highlight ? "var(--accent)" : "var(--text)" }}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span
                    className="text-lg ml-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {plan.period}
                  </span>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-3 text-base"
                    style={{ color: "var(--text)" }}
                  >
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: plan.highlight ? "var(--accent-soft)" : "var(--surface-subtle)",
                        color: plan.highlight ? "var(--accent)" : "var(--text-soft)",
                      }}
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/signin")}
                className="w-full px-6 py-3 rounded-lg font-semibold text-base transition-all duration-200"
                style={{
                  background: plan.highlight ? "var(--accent)" : "var(--surface-subtle)",
                  color: plan.highlight ? "var(--accent-text)" : "var(--text)",
                  border: plan.highlight ? "none" : "1px solid var(--border-subtle)",
                }}
                onMouseEnter={(e) => {
                  if (plan.highlight) {
                    e.currentTarget.style.background = "var(--accent-strong)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  } else {
                    e.currentTarget.style.background = "var(--surface-raised)";
                    e.currentTarget.style.borderColor = "var(--border-strong)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (plan.highlight) {
                    e.currentTarget.style.background = "var(--accent)";
                    e.currentTarget.style.transform = "translateY(0)";
                  } else {
                    e.currentTarget.style.background = "var(--surface-subtle)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }
                }}
              >
                {plan.name === "Free" ? "Get started" : "Upgrade"}
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        className="mt-32"
        style={{
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p
              className="text-sm"
              style={{ color: "var(--text-soft)" }}
            >
              © {new Date().getFullYear()} ChatGPA. All rights reserved.
            </p>
            <div className="flex gap-8">
              <a
                href="#"
                className="text-sm transition-all duration-150"
                style={{ color: "var(--text-soft)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-soft)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Privacy
              </a>
              <a
                href="#"
                className="text-sm transition-all duration-150"
                style={{ color: "var(--text-soft)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-soft)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
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
