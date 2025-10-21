// src/components/FuelMeter.tsx
import { useMemo } from "react";
import { useAccount } from "../hooks/useAccount";

type FuelMeterProps = {
  userId?: string | null;
  personal?: number;
  reserve?: number;
  pool?: number;
  total?: number;
};

export function FuelMeter({ userId, personal: propPersonal, reserve: propReserve, pool: propPool, total: propTotal }: FuelMeterProps = {}) {
  // PROMPT 7: Only call useAccount if we need dynamic data (no static props provided)
  const hasStaticProps = propPersonal !== undefined && propReserve !== undefined && propPool !== undefined;
  const { account, loading } = useAccount(hasStaticProps ? null : userId);

  const personal = propPersonal ?? account?.personal_tokens ?? 0;
  const reserve = propReserve ?? account?.reserve_tokens ?? 0;
  const pool = propPool ?? account?.pool_bonus_tokens ?? 0;
  const total = propTotal ?? account?.total_available ?? Math.max(personal + reserve + pool, 1);

  const segments = useMemo(() => {
    const safeTotal = Math.max(total, 1);
    return [
      { key: 'personal', value: personal, label: 'Personal' },
      { key: 'reserve',  value: reserve, label: 'Reserve' },
      { key: 'pool',     value: pool, label: 'Pool' },
    ].map(s => ({ ...s, pct: Math.max(0, Math.min(100, (s.value / safeTotal) * 100)) }));
  }, [personal, reserve, pool, total]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between text-sm text-white/70">
        <span>Fuel</span>
        <span>{(personal + reserve + pool).toLocaleString()} tok</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700 ease-out bg-white"
          style={{ width: `${segments[0].pct}%` }}
          title={`Personal: ${personal}`}
        />
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700 ease-out bg-white/70"
          style={{ width: `${segments[0].pct + segments[1].pct}%` }}
          title={`Reserve: ${reserve}`}
        />
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700 ease-out bg-white/40"
          style={{ width: `${segments[0].pct + segments[1].pct + segments[2].pct}%` }}
          title={`Pool bonus: ${pool}`}
        />
      </div>
      {!loading && (
        <div className="mt-3 flex gap-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1">
            <span className="block h-2 w-2 bg-white rounded-sm"></span>
            Personal {personal.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="block h-2 w-2 bg-white/70 rounded-sm"></span>
            Reserve {reserve.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="block h-2 w-2 bg-white/40 rounded-sm"></span>
            Pool {pool.toLocaleString()}
          </span>
        </div>
      )}
      {!loading && total <= 0 && (
        <div className="mt-3 text-xs text-red-400">
          You're out of fuel. <a href="/account" className="underline hover:text-red-300">Refuel to keep chatting</a>.
        </div>
      )}
    </div>
  );
}
