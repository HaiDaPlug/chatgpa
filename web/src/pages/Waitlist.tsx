import { useState, useMemo } from 'react';
import { Check } from 'lucide-react';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [trap, setTrap] = useState(''); // honeypot

  const isValid = useMemo(() => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setError('');

    try {
      const resp = await fetch('/api/join-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source, trap })
      });

      const ct = resp.headers.get('content-type') || '';
      let payload: any = null;

      if (ct.includes('application/json')) {
        try { payload = await resp.json(); } catch { payload = null; }
      } else {
        try { payload = await resp.text(); } catch { payload = ''; }
      }

      if (!resp.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
        const msg =
          (payload && typeof payload === 'object' && payload.error) ? payload.error :
          (typeof payload === 'string' && payload.length ? payload :
          `Failed (${resp.status})`);
        throw new Error(msg);
      }

      setStatus('success');
      setEmail('');
      setSource('');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Server error');
    }
  }

  return (
    <div className="relative min-h-[100svh] bg-black text-white">
      <BgFixed />       {/* z-0 (above bg-black), not negative */}
      <BottomFade />

      <main className="relative z-10">
        <section className="w-full px-4 pt-8 pb-16 md:pt-16 md:px-8 lg:px-16">
          <div className="mx-auto max-w-7xl">
            {/* Hero */}
            <div className="w-full text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Founding riders get bonus fuel.
              </div>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                Carpool into GPT-5 for less.<span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"></span>
              </h1>
              <p className="mt-4 text-balance text-white/70 md:text-lg">
                Split the ride, keep the full experience. Join the waitlist for early access,
                bonus fuel, and launch updates.
              </p>
            </div>

            {/* Form Card */}
            <div className="relative z-20 pointer-events-auto mx-auto mt-8 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur md:p-6">
              {status === 'success' ? (
                <SuccessCard />
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  {/* Honeypot */}
                  <input
                    aria-hidden
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    value={trap}
                    onChange={(e) => setTrap(e.target.value)}
                    placeholder="Leave this empty"
                  />

                  <div className="grid gap-3 md:grid-cols-[1fr,160px]">
                    <div>
                      <label className="mb-1 block text-sm text-white/70">Email</label>
                      <input
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none ring-0 transition focus:border-white/20"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-white/70">How did you find us? (optional)</label>
                      <input
                        className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-white outline-none ring-0 transition focus:border-white/20"
                        type="text"
                        placeholder="Threads / X / Reddit / Friend"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      />
                    </div>
                  </div>

                  {status === 'error' && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    aria-disabled={status === 'loading'}
                    className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-white px-4 py-3 font-medium text-black transition hover:opacity-90"
                  >
                    <span className="relative z-10">
                      {status === 'loading' ? 'Joining…' : 'Join the waitlist.'}
                    </span>
                    <div
                      aria-hidden
                      className="absolute inset-0 -z-0 opacity-0 transition group-hover:opacity-100"
                      style={{
                        background:
                          'radial-gradient(60% 60% at 50% 50%, rgba(255,115,115,0.35) 0%, rgba(255,115,115,0) 60%)'
                      }}
                    />
                  </button>

                  <p className="text-center text-xs text-white/60">
                    No spam. We’ll email you about launch and bonuses only.
                  </p>
                </form>
              )}
            </div>

            {/* Mini features */}
            <ul className="mt-10 grid w-full grid-cols-1 gap-3 text-sm text-white/70 md:grid-cols-3">
              <FeatureItem title="Lower monthly cost." />
              <FeatureItem title="Fuel meter transparency." />
              <FeatureItem title="Founding rider perks." />
            </ul>

            {/* Trust row */}
            <div className="mt-10 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
              <span className="inline-flex items-center gap-2">
                <Dot /> Built on Vercel + Supabase.
              </span>
              <span className="inline-flex items-center gap-2">
                <Dot /> Privacy-first, no spam.
              </span>
              <span className="inline-flex items-center gap-2">
                <Dot /> Cancel anytime after launch.
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10">
        <div className="flex w-full items-center justify-between px-4 py-6 text-xs text-white/50 md:px-8 lg:px-16">
          <span>© {new Date().getFullYear()} Carpool AI</span>
          <span>Launching soon...</span>
        </div>
      </footer>
    </div>
  );
}

/* —— Glow layer: z-0 (above bg), fixed to viewport —— */
function BgFixed() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background: `
          radial-gradient(40vw 28vw at 50% 0%,     rgba(255,115,115,0.28) 0%, rgba(255,115,115,0) 70%),
          radial-gradient(34vw 26vw at 12% 92%,    rgba(255,184,108,0.18) 0%, rgba(255,184,108,0) 70%),
          radial-gradient(42vw 32vw at 88% 92%,    rgba(255,115,115,0.10) 0%, rgba(255,115,115,0) 75%)
        `,
        backgroundRepeat: 'no-repeat',
        filter: 'blur(60px)',
        opacity: 0.9
      }}
    />
  );
}

/* —— Bottom fade —— */
function BottomFade() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 h-40 z-0"
    >
      <div className="h-full w-full bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

/* ——— UI bits ——— */
function FeatureItem({ title }: { title: string }) {
  return (
    <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-white/80" aria-hidden />
        <span>{title}</span>
      </div>
    </li>
  );
}

function Dot() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40" aria-hidden />;
}

function SuccessCard() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2 text-emerald-300">
          <Check className="h-5 w-5" aria-hidden />
          <p className="font-medium">You’re in! 🚗⛽</p>
        </div>
        <p className="mt-1 text-sm text-emerald-200/80">
          We’ll email you when the beta opens and send your founding-rider bonus fuel.
        </p>
      </div>
      <p className="text-center text-sm text-white/60">
        Want to help? Share this page with a friend who uses AI a lot.
      </p>
    </div>
  );
}
