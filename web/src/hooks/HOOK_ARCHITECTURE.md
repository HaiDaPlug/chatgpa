# Hook Architecture - V16

## Overview

This document explains the architectural decisions behind Carpool AI's dual-hook balance tracking system in V16.

## The Dual-Hook Pattern

### Why Two Hooks?

We maintain two separate hooks for balance tracking:

1. **`useLedger`** - Lightweight, optimistic, API-based
2. **`useAccount`** - Authoritative, Supabase-based, with breakdown

This is **intentional and stable for V16**. Do not alias or merge these hooks without explicit approval.

### Design Rationale

#### Historical Context

- **V15:** Used only `useAccount` hook querying Supabase `v_account` view
- **V16:** Introduced `useLedger` for optimistic updates and test mode support
- **Future (V17):** May consolidate after proving both patterns work

#### Why Not One Hook?

**Option 1: Single unified hook** ❌
```tsx
// Would require:
const { balance, personal, reserve, pool, bump, refresh, loading } = useUnifiedAccount();
// Problems:
// - Too many responsibilities
// - FuelMeter doesn't need optimistic updates
// - Chat doesn't need token breakdown
// - Different polling intervals needed
```

**Option 2: Dual specialized hooks** ✅
```tsx
// Clean separation:
const ledger = useLedger();          // Chat: balance + bump
const { account } = useAccount();     // FuelMeter: breakdown

// Benefits:
// - Single responsibility per hook
// - Independent evolution
// - No unnecessary data fetching
// - Clear migration path
```

## Hook Comparison

### useLedger

**File:** `web/src/hooks/useLedger.ts`

**Purpose:** Fast, optimistic balance tracking for chat interactions

**Data Source:** `/api/account` endpoint (or stub fallback)

**Key Features:**
- ✅ Optimistic updates via `bump()`
- ✅ Configurable polling (20-30s in test mode)
- ✅ Stub fallback for offline development
- ✅ Lightweight (balance + tierCap only)

**API:**
```tsx
export type LedgerState = {
  balance: number | null;
  tierCap?: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  bump: (delta: number) => void;
};
```

**Polling Strategy:**
- Test mode: 20-30s random interval (avoid thundering herd)
- Production: No polling (manual `refresh()` only)
- Rationale: Reduce API load, user triggers refresh on action

**When to Use:**
- ✅ Chat page (needs optimistic drain)
- ✅ Any component displaying balance
- ✅ Post-purchase flows (call `refresh()`)

### useAccount

**File:** `web/src/hooks/useAccount.ts`

**Purpose:** Authoritative account breakdown from Supabase

**Data Source:** Supabase `v_account` view

**Key Features:**
- ✅ Token breakdown (personal/reserve/pool)
- ✅ Direct Supabase query (authoritative)
- ✅ Frequent polling (5s) for real-time accuracy
- ❌ No optimistic updates

**API:**
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

**Polling Strategy:**
- Always polls every 5s
- Rationale: FuelMeter needs accurate breakdown for segments

**When to Use:**
- ✅ FuelMeter component (needs segment data)
- ✅ Account page (displays breakdown)
- ❌ **Don't use** for simple balance checks

## Component Usage Map

| Component | Hook Used | Why |
|-----------|-----------|-----|
| Chat.tsx | `useLedger` | Optimistic token drain after send |
| FuelMeter.tsx | `useAccount` | Needs personal/reserve/pool breakdown |
| Account.tsx | `useAccount` | Displays full account details |
| Pricing.tsx | None | Static pricing data |
| Debug.tsx | None | Shows env/session only |

## Data Flow

### Chat Send Flow (useLedger)

```
1. User sends message
   ↓
2. API call to /api/chat
   ↓
3. Response: { reply, usage: { total_tokens: 1200 } }
   ↓
4. ledger.bump(-1200)  [OPTIMISTIC UPDATE]
   ↓
5. UI immediately shows reduced balance
   ↓
6. Background: ledger polls /api/account every 20-30s
   ↓
7. Eventually consistent with authoritative balance
```

### Purchase Flow (both hooks)

```
1. User completes checkout
   ↓
2. Redirect to /chat?new_purchase=1
   ↓
3. Toast: "Fuel added! 🚗"
   ↓
4. ledger.refresh()  [Fetch new balance]
   ↓
5. FuelMeter polls account via useAccount
   ↓
6. Both hooks show updated balance
```

## Avoiding Anti-Patterns

### ❌ Anti-Pattern 1: Aliasing Hooks

```tsx
// DON'T DO THIS
export function useBalance() {
  const ledger = useLedger();
  const { account } = useAccount();
  return ledger.balance ?? account?.total_available;
}

// WHY: Hides which hook is being used, harder to debug, double polling
```

### ❌ Anti-Pattern 2: Using Wrong Hook

```tsx
// DON'T: Using useAccount for simple balance
const { account } = useAccount(userId);
const balance = account?.total_available ?? 0;

// DO: Use useLedger instead
const ledger = useLedger();
const balance = ledger.balance ?? 0;
```

### ❌ Anti-Pattern 3: Forgetting Optimistic Updates

```tsx
// DON'T: Waiting for polling to reflect drain
await sendChat(message);
// User sees stale balance for 20-30s

// DO: Bump immediately
const result = await sendChat(message);
if (result.usage?.total_tokens) {
  ledger.bump(-result.usage.total_tokens);
}
```

## Testing Strategy

### Unit Tests

#### useLedger Tests
- ✅ Fetches balance on mount
- ✅ Falls back to stub data on error
- ✅ `bump()` updates balance locally
- ✅ `refresh()` fetches fresh data
- ✅ Polling starts/stops correctly in test mode

#### useAccount Tests
- ✅ Queries Supabase v_account view
- ✅ Returns null for unauthenticated user
- ✅ Polls every 5s
- ✅ `refresh()` triggers immediate fetch

### Integration Tests

#### Chat Flow
1. Send message → balance drains optimistically
2. Wait 1s → balance still drained (didn't revert)
3. Wait 25s → polling confirms new balance
4. No console errors

#### Purchase Flow
1. Complete checkout → redirect to /chat?new_purchase=1
2. Toast appears
3. Balance refreshes within 2s
4. FuelMeter animates to new value

## Migration Path (V15 → V16 → V17)

### V15 (Legacy)
- Single `useAccount` hook
- All components poll Supabase every 5s
- No optimistic updates
- Heavy Supabase load

### V16 (Current - Stable)
- Dual hooks: `useLedger` + `useAccount`
- Chat uses `useLedger` (optimistic)
- FuelMeter uses `useAccount` (breakdown)
- Reduced Supabase load
- Gradual migration path

### V17 (Future - TBD)
**Option A:** Consolidate into single enhanced hook
```tsx
const { balance, breakdown, bump, refresh } = useBalance({ needsBreakdown: true });
```

**Option B:** Keep dual hooks if they work well
- Maintain current separation
- Document as stable pattern

**Option C:** Deprecate useAccount, enhance useLedger
```tsx
const ledger = useLedger({ includeBreakdown: true });
ledger.breakdown?.personal_tokens;
```

**Decision criteria for V17:**
- ✅ Have both hooks proven stable in production?
- ✅ Is dual-hook complexity worth the benefits?
- ✅ Are FuelMeter + Chat happy with current API?

## Stability Contract

### @stable V16 Tag

Both hooks are marked `@stable V16`:

```tsx
/**
 * @stable V16 — balance, bump, polling. Preferred for new code.
 */
export function useLedger(): LedgerState { ... }

/**
 * @stable V16 — Supabase breakdown. Keep for FuelMeter/Account.
 */
export function useAccount(userId?: string | null): { ... }
```

**What this means:**
- ✅ API will not change within V16
- ✅ Safe to use in production code
- ✅ No breaking changes without major version bump
- ✅ Future refactors must maintain these interfaces

### Deprecation Policy

If we consolidate in V17:
1. Mark old hooks `@deprecated`
2. Provide migration guide
3. Support for 2 minor versions
4. Remove in V18

## Performance Considerations

### Polling Load

**useLedger:**
- Interval: 20-30s
- Endpoint: `/api/account` (cached)
- Active: Test mode only
- Load: ~2-3 requests/minute/user

**useAccount:**
- Interval: 5s
- Query: Supabase `v_account` view
- Active: Always (when component mounted)
- Load: ~12 requests/minute/user

**Optimization opportunity:**
- FuelMeter could reduce polling to 10-15s
- Or only poll when Chat page active
- Consider WebSocket for real-time balance

### Memory Footprint

Both hooks use `useRef` to prevent memory leaks:
```tsx
const intervalRef = useRef<NodeJS.Timeout | null>(null);
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    isMountedRef.current = false;
  };
}, []);
```

## Troubleshooting

### Issue: Balance not updating after send

**Cause:** Forgot to call `ledger.bump()`

**Solution:**
```tsx
if (result.usage?.total_tokens) {
  ledger.bump(-result.usage.total_tokens);
}
```

### Issue: FuelMeter showing wrong segments

**Cause:** Using `useLedger` instead of `useAccount`

**Solution:** FuelMeter needs `useAccount` for breakdown:
```tsx
const { account } = useAccount(userId);
<FuelMeter total={account?.total_available} />
```

### Issue: Double polling (both hooks active)

**Cause:** Both hooks used in same component unnecessarily

**Solution:** Use only the hook you need:
- Need balance + optimistic updates? → `useLedger`
- Need token breakdown? → `useAccount`

### Issue: Stale balance after purchase

**Cause:** Forgot to call `refresh()` after checkout

**Solution:**
```tsx
useEffect(() => {
  if (searchParams.get("new_purchase") === "1") {
    ledger.refresh();
  }
}, [searchParams, ledger]);
```

## Questions & Answers

**Q: Why not use React Query or SWR?**

A: We may in V17, but for V16:
- Custom hooks give us full control
- No external dependency
- Optimistic updates tailored to our needs
- Easier to debug

**Q: Why different polling intervals?**

A: Different use cases:
- `useLedger` (20-30s): User-triggered actions, optimistic updates reduce need for frequent polling
- `useAccount` (5s): FuelMeter needs accurate real-time breakdown for segments

**Q: Can I create a wrapper hook?**

A: No. Use each hook directly where needed. Wrappers hide which data source is being used and make debugging harder.

**Q: What if I need both balance and breakdown?**

A: Use both hooks:
```tsx
const ledger = useLedger();           // For balance + optimistic
const { account } = useAccount();      // For breakdown
```

This is fine! The polling is independent and serves different purposes.

---

**Document Version:** 1.0 (Phase 3)
**Last Updated:** October 17, 2025
**Status:** Stable for V16
**Next Review:** V17 planning (TBD)
