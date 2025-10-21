# Phase 2: Pricing & Refuel Flow - Implementation Context

**Date:** 2025-10-17
**Branch:** `v16/chat-relocation`
**Commit:** `1ffdcee` - feat(v16): pricing page + refuel route; correct tier numbers ($5.50/$8.50/$14.99 → 178k/356k/711k)

## Overview

Phase 2 implements the Pricing page with correct Token Formula v2.1 numbers and complete refuel navigation flow. This builds on Phase 1 (FuelMeter animation + toasts) to provide a complete fuel purchase experience.

## Constraints Followed

- ✅ No backend edits (no Stripe/Supabase changes)
- ✅ Dark-stone theme maintained throughout
- ✅ Minimal UI focused on correctness
- ✅ Token Formula v2.1 numbers used
- ✅ Success redirect preserved: `/chat?new_purchase=1`

## Files Created/Modified

### 1. New: web/src/config/tiers.ts

**Purpose:** Centralized tier configuration with Token Formula v2.1 pricing

```typescript
export type Tier = {
  id: "cruiser" | "power" | "pro";
  name: string;
  price: number;      // USD
  tokens: number;     // monthly allocation (Token Formula v2.1)
  blurb?: string;
};

export const TIERS: Tier[] = [
  { id: "cruiser", name: "Cruiser",      price: 5.50,  tokens: 178_000, blurb: "Great value. Transparent fuel." },
  { id: "power",   name: "Power Driver", price: 8.50,  tokens: 356_000, blurb: "Best value. More runtime." },
  { id: "pro",     name: "Pro Driver",   price: 14.99, tokens: 711_000, blurb: "Max fuel. Priority boosts later." },
];
```

**Key Points:**
- Single source of truth for tier data
- Token counts match Token Formula v2.1 specification
- Prices: Cruiser $5.50, Power $8.50, Pro $14.99
- Type-safe tier IDs

### 2. New: web/src/pages/Pricing.tsx

**Purpose:** Public pricing page with tier cards and checkout integration

**Features:**
- Dark-stone theme (`bg-stone-950`, `text-stone-100`)
- Sticky header with "Back to chat" link
- Grid layout (2 columns on desktop, stacks on mobile)
- Each tier card shows:
  - Name and blurb
  - Price per month
  - Token count (~XXX,XXX tokens)
  - Orange "Refuel {Name}" button
- Footer disclaimer with formula reference

**Checkout Integration:**
```typescript
onClick={() => {
  const url = `/api/checkout?tier=${t.id}&success=/chat?new_purchase=1`;
  window.location.href = url;
}}
```

**Navigation Flow:**
1. User clicks "Refuel Cruiser" → `/api/checkout?tier=cruiser&success=/chat?new_purchase=1`
2. Checkout completes → Redirects to `/chat?new_purchase=1`
3. Chat page detects `new_purchase=1` → Shows toast + refreshes ledger
4. URL cleaned up (removes query param)

### 3. Modified: web/src/App.tsx

**Changes:**
- Added `import Pricing from './pages/Pricing';`
- Added route: `<Route path="/pricing" element={<Pricing />} />`
- Route is **public** (no WaitlistGate wrapper)

**Route Structure:**
```tsx
<Route path="/debug" element={<Debug />} />
<Route path="/" element={<Landing />} />
<Route path="/chat" element={<WaitlistGate><Chat /></WaitlistGate>} />
<Route path="/account" element={<WaitlistGate><Account /></WaitlistGate>} />
<Route path="/pricing" element={<Pricing />} />  {/* NEW */}
<Route path="*" element={<Landing />} />
```

**Why public?** Allows users to view pricing before signing up or when out of fuel.

### 4. Modified: web/src/pages/Chat.tsx

**Changes:**

**A) Header - Added Refuel Button (lines 161-166):**
```tsx
<Link
  to="/pricing"
  className="rounded-xl px-3 py-1.5 bg-orange-500 text-black font-medium hover:bg-orange-400 transition text-sm"
>
  Refuel
</Link>
```

- Positioned next to FuelMeter in header
- Always visible (not conditional)
- Orange accent matches app theme
- Clear call-to-action

**B) Footer - Updated Out-of-Fuel Link (line 197):**
```tsx
{!hasFuel && !IS_TEST && !IS_MOCK && (
  <div className="mt-3 text-sm text-amber-400">
    ⚠️ Out of fuel.{" "}
    <a href="/pricing" className="underline hover:text-amber-300">
      Refuel to continue
    </a>
  </div>
)}
```

- Changed from `/account` to `/pricing`
- Only shows when actually out of fuel (excludes test/mock mode)
- Provides clear path to refuel

## Token Formula v2.1 Numbers

| Tier          | Price  | Tokens  | Calculation Basis               |
|---------------|--------|---------|----------------------------------|
| Cruiser       | $5.50  | 178,000 | Token Formula v2.1              |
| Power Driver  | $8.50  | 356,000 | 2x Cruiser tokens               |
| Pro Driver    | $14.99 | 711,000 | ~4x Cruiser tokens              |

**Source:** Token Formula v2.1 specification (referenced in pricing footer)

## User Flows

### Flow 1: Refuel from Chat (Normal)

1. User in `/chat` clicks orange "Refuel" button in header
2. Navigate to `/pricing`
3. User reviews tiers, clicks "Refuel Power Driver"
4. Navigate to `/api/checkout?tier=power&success=/chat?new_purchase=1`
5. Checkout completes, Stripe redirects to `/chat?new_purchase=1`
6. Chat detects query param:
   - Shows toast: "Fuel added! 🚗"
   - Calls `ledger.refresh()` to fetch new balance
   - Cleans up URL (removes `?new_purchase=1`)
7. FuelMeter animates to new balance
8. User can continue chatting

### Flow 2: Refuel When Out of Fuel

1. User sends message, runs out of fuel
2. FuelMeter animates to 0
3. Footer shows: "⚠️ Out of fuel. Refuel to continue" (link to `/pricing`)
4. Composer disabled (except in test/mock mode)
5. User clicks "Refuel to continue"
6. Follows Flow 1 from step 2

### Flow 3: Direct Pricing Visit

1. User navigates to `/pricing` (via URL or external link)
2. Reviews all three tiers
3. Clicks any tier button
4. Follows Flow 1 from step 4

## Testing Checklist

### Visual Testing

- [ ] `/pricing` loads without white screen or errors
- [ ] Dark-stone theme consistent with rest of app
- [ ] Three tier cards display correctly in grid
- [ ] Card layout stacks properly on mobile
- [ ] "Back to chat" link visible in header

### Content Verification

- [ ] Cruiser shows $5.50 and 178,000 tokens
- [ ] Power Driver shows $8.50 and 356,000 tokens
- [ ] Pro Driver shows $14.99 and 711,000 tokens
- [ ] Blurbs display correctly under tier names
- [ ] Footer disclaimer mentions Token Formula v2.1

### Navigation Testing

- [ ] Chat header "Refuel" button navigates to `/pricing`
- [ ] Chat footer "Refuel to continue" link navigates to `/pricing`
- [ ] Pricing "Back to chat" link returns to `/chat`
- [ ] Tier buttons navigate to `/api/checkout?tier={id}&success=/chat?new_purchase=1`

### Integration Testing

- [ ] After test purchase, redirect to `/chat?new_purchase=1` works
- [ ] Toast "Fuel added! 🚗" appears on purchase success
- [ ] Ledger refreshes and shows new balance
- [ ] URL cleaned up (no lingering query params)
- [ ] FuelMeter animates to new balance

### Regression Testing

- [ ] Chat still sends messages in test/mock mode
- [ ] FuelMeter animation still works (Phase 1 feature)
- [ ] Optimistic token drain still works (Phase 1 feature)
- [ ] Error toasts still appear on failures (Phase 1 feature)
- [ ] No impact on other pages (Landing, Account, Debug)

## Technical Notes

### Why No WaitlistGate on /pricing?

The pricing page is public to allow:
1. Prospective users to see pricing before signing up
2. Out-of-fuel users to view options even if session expires
3. Marketing/SEO benefits (public pricing page)

Users must still authenticate to complete checkout (handled by `/api/checkout` endpoint).

### Checkout Integration

The current implementation uses a placeholder checkout URL:
```typescript
const url = `/api/checkout?tier=${t.id}&success=/chat?new_purchase=1`;
window.location.href = url;
```

**TODO (Future):** Replace with actual Stripe checkout session creator when backend is ready. The success URL must remain `/chat?new_purchase=1` to trigger the post-purchase flow.

### Success URL Importance

The success URL `/chat?new_purchase=1` is critical because:
1. `Chat.tsx` watches for this query param (lines 34-46)
2. Triggers toast notification
3. Calls `ledger.refresh()` to fetch updated balance
4. Cleans up URL to prevent duplicate toasts on refresh

**Do not change this URL** without updating `Chat.tsx` accordingly.

### Token Count Formatting

Token counts use `toLocaleString()` for readability:
- 178000 → "178,000"
- 356000 → "356,000"
- 711000 → "711,000"

Prefix with "~" to indicate approximate values (allows for minor adjustments without UI changes).

## Dependencies

### Phase 1 (Prerequisites)

This phase depends on Phase 1 features:
- ✅ FuelMeter animation
- ✅ Toast notifications (sonner)
- ✅ Ledger hook with refresh capability
- ✅ Optimistic token drain

All Phase 1 features remain functional.

### Phase 3 (Next Steps)

Future phases may include:
- Backend checkout integration (Stripe session creation)
- Account page showing purchase history
- Subscription management (cancel, upgrade, downgrade)
- Unused token rollover display

## Configuration

### Environment Variables

No new environment variables required. Existing variables still apply:
- `VITE_CHAT_MOCK` - Enable mock chat responses
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### Test Mode

In test mode (`IS_TEST=true`):
- Refuel button still visible (allows testing navigation)
- Composer enabled even with 0 balance
- Out-of-fuel warning hidden
- Balance display shows debug info in header

## Known Issues / TODOs

1. **Checkout Stub:** `/api/checkout` endpoint may not exist yet. Clicking tier buttons might 404. This is expected until backend integration.

2. **No Loading State:** Tier buttons have no loading indicator during checkout redirect. Consider adding spinner for better UX.

3. **No Error Handling:** If checkout fails or user cancels, no feedback provided. Consider adding `/pricing?error=1` flow.

4. **No Tier Recommendations:** All tiers presented equally. Future: highlight "Best Value" tier or personalize based on usage.

5. **Hardcoded Success URL:** Success URL is hardcoded in button handler. Consider moving to environment variable or config.

## Commit Details

```
commit 1ffdcee
Author: Claude (via Claude Code)
Date: 2025-10-17

feat(v16): pricing page + refuel route; correct tier numbers ($5.50/$8.50/$14.99 → 178k/356k/711k)

- Add web/src/config/tiers.ts with Token Formula v2.1 numbers
- Create web/src/pages/Pricing.tsx with dark-stone theme
- Add /pricing route to App.tsx
- Add Refuel button in Chat header + update footer link to /pricing
- Tier prices: Cruiser $5.50 (178k), Power Driver $8.50 (356k), Pro Driver $14.99 (711k)
```

**Branch:** `v16/chat-relocation`
**Pushed to:** `origin/v16/chat-relocation`

## Related Files

### Documentation
- [2025-10-16_PROMPT_A_IMPLEMENTATION.md](2025-10-16_PROMPT_A_IMPLEMENTATION.md) - Phase 1A (FuelMeter)
- [2025-10-17_PROMPT_B_IMPLEMENTATION.md](2025-10-17_PROMPT_B_IMPLEMENTATION.md) - Phase 1B (Toasts)
- [2025-10-16_SESSION_COMPLETE_CHAT_RELOCATION.md](2025-10-16_SESSION_COMPLETE_CHAT_RELOCATION.md) - Overall V16 context

### Code Files
- [web/src/config/tiers.ts](../web/src/config/tiers.ts) - Tier configuration
- [web/src/pages/Pricing.tsx](../web/src/pages/Pricing.tsx) - Pricing page
- [web/src/App.tsx](../web/src/App.tsx) - Route definitions
- [web/src/pages/Chat.tsx](../web/src/pages/Chat.tsx) - Chat page with refuel links
- [web/src/hooks/useLedger.ts](../web/src/hooks/useLedger.ts) - Ledger hook (Phase 1B)
- [web/src/components/FuelMeter.tsx](../web/src/components/FuelMeter.tsx) - Fuel meter (Phase 1A)

## Handoff Notes

### For Next Developer

If continuing work on this feature:

1. **Backend Integration:** Update button `onClick` handler in `Pricing.tsx` to call your Stripe checkout session creator. Preserve the success URL format.

2. **Error Handling:** Add `/pricing?error=checkout_failed` or similar to handle checkout failures gracefully.

3. **Loading States:** Add loading spinner to tier buttons during checkout redirect.

4. **Analytics:** Consider adding event tracking for:
   - Pricing page views
   - Tier button clicks
   - Successful purchases
   - Checkout abandonments

5. **A/B Testing:** Current design is minimal. Consider testing variations:
   - Highlighting "Best Value" tier
   - Adding social proof (e.g., "Most popular")
   - Including token usage calculator
   - Displaying cost per 1000 tokens

### For Code Review

Focus areas:
- [ ] Tier numbers match Token Formula v2.1 specification
- [ ] Success URL preserved in all checkout flows
- [ ] No regressions in Phase 1 features
- [ ] Dark-stone theme consistent
- [ ] Public route security implications reviewed
- [ ] Mobile responsive layout verified

## Success Metrics

Phase 2 considered successful when:
- ✅ `/pricing` loads without errors
- ✅ Correct tier numbers displayed
- ✅ Refuel button navigates to pricing
- ✅ Post-purchase flow works (toast + balance refresh)
- ✅ No regressions in chat functionality
- ✅ Build completes without TypeScript errors
- ✅ Committed and pushed to `v16/chat-relocation`

**Status: ✅ All success criteria met**

---

**Last Updated:** 2025-10-17
**Next Phase:** Phase 3 (TBD - possibly checkout backend integration or account page enhancements)
