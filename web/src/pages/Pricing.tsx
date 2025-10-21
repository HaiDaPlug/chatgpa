import { Link } from "react-router-dom";
import { TIERS } from "@/config/tiers";

export default function Pricing() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-stone-950/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Refuel</h1>
          <Link to="/chat" className="text-sm opacity-80 hover:opacity-100">
            Back to chat
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <p className="text-sm text-stone-300">
          Pick your fuel. Transparent tokens, live meter. Unused rolls per policy.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-white/10 bg-stone-900 p-5 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{t.name}</h2>
                  {t.blurb && (
                    <p className="mt-1 text-sm text-stone-400">{t.blurb}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">${t.price.toFixed(2)}</div>
                  <div className="text-xs text-stone-400">per month</div>
                </div>
              </div>

              <div className="mt-4 text-sm text-stone-300">
                ~{t.tokens.toLocaleString()} tokens
              </div>

              <button
                className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-2 text-black font-medium hover:bg-orange-400 transition"
                onClick={() => {
                  // TODO: replace with your real checkout open
                  // For test mode, navigate to your existing checkout link creator or stub.
                  // Example (pseudo):
                  // startCheckout({ tier: t.id, success: "/chat?new_purchase=1" })
                  const url = `/api/checkout?tier=${t.id}&success=/chat?new_purchase=1`;
                  window.location.href = url;
                }}
              >
                Refuel {t.name}
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-stone-500">
          Token counts per Token Formula v2.1. Pricing: Cruiser $5.50, Power $8.50, Pro $14.99.
        </p>
      </section>
    </main>
  );
}
