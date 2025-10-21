// src/components/FuelMeterPreview.tsx
import { useEffect, useRef, useState } from 'react';

// minimal inline meter (keeps the real FuelMeter free for prod)
export function FuelMeterPreview({
  startPersonal = 600,
  startReserve = 300,
  startPool = 120,
  drainTotal = 180,          // how many tokens to drain on play
  durationMs = 2500,         // how long the drain takes
  playSignal,                // bump this value to start a drain
}: {
  startPersonal?: number;
  startReserve?: number;
  startPool?: number;
  drainTotal?: number;
  durationMs?: number;
  playSignal?: number;
}) {
  const [personal, setPersonal] = useState(startPersonal);
  const [reserve, setReserve] = useState(startReserve);
  const [pool, setPool] = useState(startPool);
  const total = personal + reserve + pool;
  const [isDraining, setIsDraining] = useState(false);
  const [showFloating, setShowFloating] = useState(false);

  const rafRef = useRef<number | null>(null);
  const animRef = useRef<{ fromP: number; fromR: number; fromB: number; ts: number } | null>(null);

  function drainOnce() {
    // compute how much to pull from each bucket (spend order: personal -> reserve -> pool)
    let p = personal, r = reserve, b = pool;
    let left = Math.min(drainTotal, p + r + b);

    const takeP = Math.min(p, left); p -= takeP; left -= takeP;
    const takeR = Math.min(r, left); r -= takeR; left -= takeR;
    const takeB = Math.min(b, left); b -= takeB;

    // Show visual feedback
    setIsDraining(true);
    setShowFloating(true);

    // animate from current to target over duration
    animRef.current = { fromP: personal, fromR: reserve, fromB: pool, ts: performance.now() };
    const target = { p, r, b };

    const tick = (t: number) => {
      if (!animRef.current) return;
      const { ts, fromP, fromR, fromB } = animRef.current;
      const k = Math.min(1, (t - ts) / durationMs);
      setPersonal(Math.round(fromP + (target.p - fromP) * k));
      setReserve(Math.round(fromR + (target.r - fromR) * k));
      setPool(Math.round(fromB + (target.b - fromB) * k));
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsDraining(false);
        // Hide floating number after animation completes
        setTimeout(() => setShowFloating(false), 500);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (playSignal) drainOnce();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSignal]);

  const safeTotal = Math.max(total, 1);
  const pctP = (personal / safeTotal) * 100;
  const pctR = ((personal + reserve) / safeTotal) * 100;
  const pctB = ((personal + reserve + pool) / safeTotal) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm text-white/70">
        <span>Fuel (preview)</span>
        <div className="relative">
          <span className={isDraining ? 'text-amber-400' : ''}>{total} tokens</span>
          {showFloating && (
            <span className="absolute -top-6 right-0 text-xs text-red-400 font-medium animate-[slideUp_1s_ease-out]">
              -{drainTotal}
            </span>
          )}
        </div>
      </div>
      <div className={`h-3 w-full rounded-full bg-white/10 overflow-hidden transition-all ${isDraining ? 'ring-2 ring-amber-400/50' : ''}`}>
        <div className="h-full bg-emerald-400 transition-[width] duration-200 ease-out" style={{ width: `${pctP}%` }} />
        <div className="h-full -mt-3 bg-amber-400 transition-[width] duration-200 ease-out" style={{ width: `${pctR}%` }} />
        <div className="h-full -mt-3 bg-blue-400 transition-[width] duration-200 ease-out" style={{ width: `${pctB}%` }} />
      </div>
      <div className="flex gap-3 text-xs text-white/60">
        <span className="inline-flex items-center gap-1 before:block before:h-2 before:w-2 before:bg-emerald-400 before:rounded-sm">Personal {personal}</span>
        <span className="inline-flex items-center gap-1 before:block before:h-2 before:w-2 before:bg-amber-400 before:rounded-sm">Reserve {reserve}</span>
        <span className="inline-flex items-center gap-1 before:block before:h-2 before:w-2 before:bg-blue-400 before:rounded-sm">Pool {pool}</span>
      </div>
      <div className="pt-1">
        <button
          className="btn-ghost text-sm"
          onClick={() => {
            // reset demo balances
            setPersonal(startPersonal);
            setReserve(startReserve);
            setPool(startPool);
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
