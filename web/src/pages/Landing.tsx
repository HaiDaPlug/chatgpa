import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase, signOut, getUserId } from "@/lib/supabase";
import TierCard from "@/components/TierCard";
import ChatPreview from "@/components/ChatPreview";
import { Zap, Gauge, Smile, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { IS_TEST } from "@/config/appMode";

/**
 * Carpool AI — Landing (Clean Version)
 * - Waitlist UI removed, backend route still active
 * - Email magic link login
 * - Early Access pricing
 */

// Feature flag for Early Access mode
const EARLY_ACCESS_MODE = import.meta.env.VITE_EARLY_ACCESS === 'true';

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  // Check auth status
  useEffect(() => {
    getUserId().then(id => {
      setUserId(id);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Removed auto-scroll behavior - page now stays at top on load

  // Handle tier selection
  const handleTierSelect = async (tier: "cruiser" | "power" | "pro") => {
    if (!userId) {
      alert("Please log in first to subscribe");
      return;
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const email = session.session?.user.email;

      if (!email) {
        alert("Unable to get user email. Please try logging in again.");
        return;
      }

      const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
      const res = await fetch("/api/router?action=stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierName, userId, email }),
      });

      const json = await res.json();
      if (json?.url) {
        window.location.href = json.url;
      } else {
        alert("Failed to create checkout. Please try again.");
      }
    } catch (err) {
      console.error("Subscription error:", err);
      alert("An error occurred. Please try again.");
    }
  };

  // Scroll to pricing
  const handleCTAClick = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  // Email magic link login
  const handleLogin = async () => {
    if (userId) {
      navigate("/chat");
    } else {
      const email = prompt("Enter your email for magic link login:");
      if (!email) return;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/` }
      });

      if (error) {
        alert(`Login failed: ${error.message}`);
      } else {
        alert("Check your email for the login link!");
      }
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUserId(null);
  };

  return (
    <main className="min-h-screen bg-stone-900 text-stone-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-stone-700/70 bg-stone-900/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Carpool AI" className="h-7 w-7" />
            <span className="font-semibold tracking-tight">Carpool AI</span>
            {IS_TEST && (
              <span className="text-xs text-yellow-400 ml-2 px-2 py-0.5 rounded border border-yellow-400/30 bg-yellow-400/10">
                Test Mode
              </span>
            )}
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-stone-300">
            <a href="#how" className="hover:text-white">How it works</a>
            {EARLY_ACCESS_MODE && <a href="#pricing" className="hover:text-white">Pricing</a>}
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {userId ? (
              <>
                <button
                  onClick={() => navigate("/chat")}
                  className="text-sm font-medium rounded-xl bg-stone-100 text-stone-900 px-3 py-1.5 hover:bg-white"
                >
                  Go to chat
                </button>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium rounded-xl border border-stone-700 px-3 py-1.5 hover:bg-stone-800"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={handleLogin}
                className="text-sm font-medium rounded-xl border border-stone-700 px-3 py-1.5 hover:bg-stone-800"
              >
                Log in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-6">
            <motion.p
              initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0 }}
              className="inline-flex w-fit items-center rounded-full border border-stone-700 bg-stone-800 px-3 py-1 text-xs text-stone-300"
            >
              Launch ready · Simple fuel pricing
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight text-white"
            >
              Accessible AI, <span className="text-white">fueled together</span>.
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
              className="text-stone-300 text-base sm:text-lg leading-relaxed max-w-prose"
            >
              <p>Premium AI without the premium price. Simple, fair fuel.</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <button
                onClick={handleCTAClick}
                className="inline-flex justify-center items-center rounded-xl bg-stone-100 text-stone-900 px-5 py-3 font-medium shadow-sm hover:opacity-90 hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-stone-100/20"
              >
                View pricing
              </button>
              <a
                href="#demo"
                className="inline-flex justify-center items-center rounded-xl border border-stone-700 px-5 py-3 font-medium text-stone-100 hover:bg-stone-800 hover:scale-105 transition-transform"
              >
                Try interactive demo
              </a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-6 text-xs text-stone-400"
            >
              <span>Transparent pricing</span>
              <span className="h-3 w-px bg-stone-700" />
              <span>No lock-in</span>
              <span className="h-3 w-px bg-stone-700" />
              <span>Fair fuel usage</span>
            </motion.div>
          </div>

          {/* Right demo preview */}
          <div className="rounded-2xl border border-stone-700 bg-stone-800/50 p-4 backdrop-blur">
            <div className="text-xs text-stone-400 mb-3 font-medium">Live Preview</div>
            <div className="scale-90 origin-top-left transform w-[111%]">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur h-64 overflow-hidden">
                <div className="h-full overflow-y-auto space-y-2">
                  <div className="flex justify-start">
                    <div className="rounded-xl rounded-bl-sm border border-white/15 bg-white/5 px-3 py-2">
                      <p className="text-xs text-white/80">Try the interactive demo below!</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="rounded-xl rounded-br-sm bg-white text-black px-3 py-2">
                      <p className="text-xs">What makes this different?</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="rounded-xl rounded-bl-sm border border-white/15 bg-white/5 px-2 py-2">
                      <div className="text-orange-300">
                        <svg width="160" height="50" viewBox="0 0 160 50" className="opacity-80">
                          <path d="M 8 15 Q 20 20 32 15 Q 44 10 56 15 Q 68 20 80 15 Q 92 10 104 15 Q 116 20 128 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.85"/>
                          <path d="M 8 25 Q 20 30 32 25 Q 44 20 56 25 Q 68 30 80 25 Q 92 20 104 25 Q 116 30 128 25" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.70"/>
                          <path d="M 8 35 Q 20 40 32 35 Q 44 30 56 35 Q 68 40 80 35 Q 92 30 104 35 Q 116 40 128 35" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-stone-400">See real fuel tracking in #demo section</p>
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="border-t border-stone-800" id="value">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: "Affordable access", body: "Use GPT-5 without the high price tag." },
              { title: "No wasted fuel", body: "Your unused fuel carries over." },
              { title: "Launch-ready MVP", body: "Lightweight stack, fast performance, simple UX." },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl border border-stone-700 bg-stone-800 p-6">
                <h3 className="font-semibold mb-2 text-white">{c.title}</h3>
                <p className="text-stone-300 text-sm leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-stone-800" id="how">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-8 text-white">How it works</h2>
          <ol className="grid sm:grid-cols-3 gap-6 list-decimal pl-5">
            {[
              { t: "Pick a tier", d: "Choose Cruiser, Power, or Pro." },
              { t: "Start chatting", d: "Simple fuel — just use it." },
              { t: "Track your usage", d: "See exactly how much fuel you use per message." },
            ].map((s, i) => (
              <li key={i} className="rounded-2xl border border-stone-700 bg-stone-800 p-6">
                <h3 className="font-medium mb-1 text-white">{s.t}</h3>
                <p className="text-stone-300 text-sm leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* INTERACTIVE PREVIEW */}
      <section className="border-t border-stone-800" id="demo">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">See how fuel works in real-time</h2>
            <p className="mt-2 text-stone-300 text-sm max-w-2xl mx-auto">
              Unlike ChatGPT's all-or-nothing subscription, Carpool AI shows exactly how much fuel you have and how it drains per message. Watch it live:
            </p>
          </div>
          <ChatPreview />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5 }}
            className="mt-10 rounded-2xl border border-stone-700 bg-stone-800 p-6"
          >
            <h3 className="font-semibold mb-4 text-white">What to expect</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex items-start gap-3"
              >
                <Zap className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">Fast chat UI</div>
                  <div className="text-xs text-stone-400">Real-time streaming with visible fuel tracking</div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-start gap-3"
              >
                <Gauge className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">Transparent pricing</div>
                  <div className="text-xs text-stone-400">Simple tiers with honest token math</div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex items-start gap-3"
              >
                <Smile className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">No lock-in</div>
                  <div className="text-xs text-stone-400">Cancel anytime, unused fuel carries over</div>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="flex items-start gap-3"
              >
                <Users className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-white">Fair usage</div>
                  <div className="text-xs text-stone-400">Pay for what you use, no hidden fees</div>
                </div>
              </motion.div>
            </div>
            <button
              onClick={handleLogin}
              className="inline-flex rounded-xl bg-stone-100 text-stone-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get started
            </button>
          </motion.div>
        </div>
      </section>

      {/* PRICING */}
      {EARLY_ACCESS_MODE && (
        <section className="border-t border-stone-800" id="pricing">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Simple, transparent pricing</h2>
              <p className="mt-2 text-stone-300">Choose the tier that fits your usage. No surprises.</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <TierCard
                name="Cruiser"
                price="$5.50"
                tokens="~178k tokens/mo"
                note="Perfect for light usage"
                onClick={() => handleTierSelect("cruiser")}
              />
              <TierCard
                name="Power"
                price="$7.99"
                tokens="~356k tokens/mo"
                note="Best value for regulars"
                onClick={() => handleTierSelect("power")}
              />
              <TierCard
                name="Pro"
                price="$14.99"
                tokens="~711k tokens/mo"
                note="For power users"
                onClick={() => handleTierSelect("pro")}
              />
            </div>
            {!userId && (
              <p className="mt-6 text-center text-sm text-stone-400">
                <button onClick={handleLogin} className="underline hover:text-stone-300">
                  Log in
                </button>
                {" "}to get started
              </p>
            )}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="border-t border-stone-800" id="faq">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6 text-white">FAQ</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { q: "Is this live?", a: "Yes! Sign up and start chatting today." },
              { q: "How do I use it?", a: "Log in, pick a tier, and chat normally with visible fuel tracking." },
              { q: "Can I cancel?", a: "Yes, anytime. Unused fuel carries over." },
              { q: "Which models?", a: "Launching with GPT-5 access; future multi-model support planned." },
            ].map((f, i) => (
              <div key={i} className="rounded-2xl border border-stone-700 bg-stone-800 p-6">
                <h3 className="font-medium text-white">{f.q}</h3>
                <p className="text-stone-300 text-sm mt-1 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-stone-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 text-sm text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} Carpool AI</div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-stone-200">X</a>
            <a href="#" className="hover:text-stone-200">Threads</a>
            <a href="#" className="hover:text-stone-200">Reddit</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
