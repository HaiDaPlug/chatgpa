export type Tier = 'cruiser' | 'power' | 'pro';

// GPT-5-based monthly personal allocations (Token Formula v2.1 locked)
export const MONTHLY_PERSONAL: Record<Tier, number> = {
  cruiser: 178_000,
  power:   356_000,
  pro:     711_000,
};

// Reserve caps (tokens)
export const RESERVE_CAP: Record<Tier, number> = {
  cruiser: 890_000,
  power:   1_780_000,
  pro:     3_560_000,
};

// Spending order: personal → reserve
export const SPENDING_ORDER = ['personal', 'reserve'] as const;
export type SpendBucket = typeof SPENDING_ORDER[number];

export const pct = (num: number, den: number) =>
  den <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((num / den) * 100)));

export const clampReserve = (tier: Tier, reserve: number) =>
  Math.min(reserve, RESERVE_CAP[tier]);

export const formatTokens = (n: number) =>
  n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
  : n >= 1_000 ? (n / 1_000).toFixed(0) + 'k'
  : String(n);
