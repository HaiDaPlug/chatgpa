// Purpose: Sign up page (placeholder)
// TODO: Implement full signup flow

import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Signup() {
  return (
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.18,
          ease: [0.4, 0, 0.2, 1],
        }}
        className="w-full max-w-md"
      >
        <div
          className="rounded-xl p-6 shadow-sm text-center"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h1
            className="text-2xl font-semibold mb-4"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--text)",
            }}
          >
            Sign up for ChatGPA
          </h1>
          <p
            className="mb-6 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Sign up functionality coming soon.
          </p>
          <Link
            to="/signin"
            className="inline-block px-4 py-2.5 rounded-md font-medium text-sm transition-all focus:outline-none"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            }}
          >
            Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
