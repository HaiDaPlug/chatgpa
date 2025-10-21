# Hooks Documentation

## Quick Start: useLedger (5-line example)

```tsx
const ledger = useLedger();
console.log(ledger.balance);  // Current balance
ledger.bump(-1200);           // Optimistic drain
await ledger.refresh();       // Manual refresh
```

## Balance Tracking: Dual-Hook Policy

### Overview
We currently use **two hooks** for balance tracking, each serving a specific purpose:

1. **`useLedger`** - New hook for balance tracking with optimistic updates
2. **`useAccount`** - V15 hook for account breakdown (personal/reserve/pool)

### When to Use Each Hook

#### ✅ Use `useLedger` for:
- **New code** requiring balance tracking
- **Optimistic UI updates** (e.g., token drain after chat send)
- **Test mode polling** (20-30s interval)
- **Fallback resilience** (stub data when API unavailable)

**Example:**
```tsx
import { useLedger } from '@/hooks/useLedger';

const ledger = useLedger();

// Display balance
const balance = ledger.balance ?? 0;

// Optimistic drain after send
if (result.usage?.total_tokens) {
  ledger.bump(-result.usage.total_tokens);
}

// Manual refresh (e.g., after purchase)
await ledger.refresh();
```

#### ✅ Use `useAccount` for:
- **Account breakdown** (personal/reserve/pool tokens)
- **FuelMeter component** (needs segment data)
- **V15 compatibility** (existing components)

**Example:**
```tsx
import { useAccount } from '@/hooks/useAccount';

const { account } = useAccount(userId);

// Get breakdown for FuelMeter
<FuelMeter
  personal={account?.personal_tokens}
  reserve={account?.reserve_tokens}
  pool={account?.pool_bonus_tokens}
  total={account?.total_available}
/>
```

### Hook Comparison

| Feature | `useLedger` | `useAccount` |
|---------|------------|--------------|
| **Returns** | `{ balance, tierCap, loading, refresh, bump }` | `{ account, loading, error, refresh }` |
| **Data Source** | `/api/account` or stub | Supabase `v_account` view |
| **Polling** | 20-30s (test mode only) | 5s (always) |
| **Optimistic Updates** | ✅ `bump()` method | ❌ No |
| **Fallback** | ✅ Stub data (200k/356k) | ❌ Returns null |
| **Breakdown** | ❌ Total only | ✅ Personal/reserve/pool |

### Current Usage in Chat.tsx

```tsx
// Both hooks used for different purposes
const { account, refresh } = useAccount(userId);  // V15 account breakdown
const ledger = useLedger();                        // Optimistic updates

// Display balance (ledger first for optimistic updates)
const displayBalance = ledger.balance ?? account?.total_available ?? 0;

// Gating logic (allows test/mock mode)
const IS_MOCK = import.meta.env.VITE_CHAT_MOCK === '1';
const hasFuel = displayBalance > 0;
const isComposerDisabled = pending || (!IS_TEST && !IS_MOCK && !hasFuel);

// Optimistic drain after send
if (result.ok && result.usage?.total_tokens) {
  ledger.bump(-result.usage.total_tokens);
}

// Post-purchase refresh
refresh();          // useAccount
ledger.refresh();   // useLedger
```

### Test Mode Behavior

#### `useLedger` in Test Mode
- ✅ Polls every 20-30s (randomized)
- ✅ Console logs all activity
- ✅ Falls back to stub data (200k/356k)
- ✅ Displays balance in header

#### `useAccount` in Test/Production
- Polls every 5s (always)
- Queries Supabase `v_account` view
- No special test mode behavior

### Future Considerations

We may **consolidate these hooks in V17** by either:

1. **Option A:** Enhance `useLedger` to include breakdown
2. **Option B:** Deprecate `useAccount` and migrate all usages
3. **Option C:** Keep both if they serve distinct purposes well

For now, the dual-hook approach provides:
- ✅ Gradual migration path
- ✅ Backward compatibility with V15
- ✅ Optimistic updates without breaking existing code
- ✅ Fallback resilience

### API Reference

#### `useLedger()`

```tsx
export type LedgerState = {
  balance: number | null;
  tierCap?: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  bump: (delta: number) => void;
};

export function useLedger(): LedgerState;
```

**Methods:**
- `refresh()` - Manually fetch latest balance
- `bump(delta)` - Optimistic local update (e.g., `bump(-1200)` to drain)

**Behavior:**
- Fetches from `/api/account` on mount
- Falls back to stub data if API unavailable
- Polls every 20-30s in test mode only
- Clears interval on unmount

#### `useAccount(userId)`

```tsx
export type AccountData = {
  user_id: string;
  personal_tokens: number;
  reserve_tokens: number;
  pool_bonus_tokens: number;
  total_available: number;
};

export function useAccount(userId?: string | null): {
  account: AccountData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};
```

**Methods:**
- `refresh()` - Manually fetch latest account data

**Behavior:**
- Queries Supabase `v_account` view
- Polls every 5 seconds (always)
- Returns null if user not authenticated or no data
- Clears interval on unmount

---

**Last Updated:** October 16, 2025 (Prompt A - Revised)
