// web/src/lib/ui-copy.ts
// Centralized UI copy for ChatGPA (v1.1)
// Usage: import { COPY } from "@/lib/ui-copy"

export const COPY = {
  hero: {
    title: "Make studying suck less — actually learn.",
    sub: "Don’t know where to start? Dump your notes and generate a quiz instantly.",
    cta: "Get Started Free →",
    altTagline: "The friendliest way to turn chaos into clarity.",
  },

  dashboard: {
    welcome: "Welcome back — ready to study smarter?",
    emptyClasses: "No classes yet — let’s create your first one and get organized.",
    emptyQuizzes: "No quizzes yet — let’s make your first one and see how much you already know.",
    progressHeader: "You’re getting sharper every session.",
    usageStrip: (used: number, limit: number) =>
      `${used} of ${limit} quizzes used — killing it so far 🔥`,
  },

  generate: {
    header: "Turn your notes into a quiz in seconds.",
    dropHint: "Drop your notes or paste text here — I’ll do the heavy lifting.",
    button: "Generate Quiz →",
    loading: "Cooking up questions… give me a sec.",
    success: "Quiz ready ✅ Let’s see what you’ve got.",
    // surfaced when quick guards or RLS block an insert, etc.
    errorGeneric: "Something tripped up — no stress, let’s retry.",
    errorAuth: "You need to sign in to generate quizzes.",
    errorUsage: "You’ve hit your free limit — upgrade to keep going.",
  },

  results: {
    header: "You’re getting sharper.",
    sub: "These are the topics that could use a quick refresh — I’ve got your back.",
    reviewAgain: "Review Again →",
    nextRound: "Nice work — ready for the next round?",
  },

  sidebar: {
    studyTools: "Study Tools",
    generateQuiz: "Generate Quiz",
    flashcards: "Flashcards (coming soon)",
    summarize: "Summarize (coming soon)",
  },

  usageModal: {
    title: "You’ve hit your free limit 🎓",
    body: "Upgrade to keep your streak going and unlock more study sessions.",
    cta: "Upgrade →",
  },

  toasts: {
    saved: "Saved.",
    deleted: "Deleted.",
    updated: "Updated.",
  },

  errors: {
    // API-level messages that the UI can map from { code, message }
    unknown: "Something tripped up — no stress, let’s retry.",
    notAllowed: "This action isn’t available for your account.",
    rlsBlocked: "We couldn’t find that item — it may belong to another account.",
    parse: "I couldn’t make sense of that response — try a shorter note or re-paste.",
    network: "Network issue — check your connection and try again.",
  },

  // Micro-rules to keep tone consistent (can be shown in a dev-only tooltip if you want)
  rules: {
    voice: "friendly > formal · clear > clever",
    tone: "encouraging, human, calm",
    emotionFlow: "Relief → Confidence → Momentum",
  },
} as const;

// Optional helper to safely pick strings by path (prevents undefined typos)
export function getCopy<T>(path: (obj: typeof COPY) => T): T {
  return path(COPY);
}

/**
 * Example:
 *   import { COPY } from "@/lib/ui-copy";
 *   <h1>{COPY.hero.title}</h1>
 *   <p>{COPY.dashboard.usageStrip(3, 5)}</p>
 */
