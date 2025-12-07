# Session 26: Dev Override for Quiz Limits

**Date**: 2025-12-08
**Branch**: main
**Status**: ✅ Complete

## Overview

Added development environment override for quiz limits to enable easier local testing without hitting the 5-quiz free tier limit. When `APP_MODE=test`, free users can generate up to 100 quizzes instead of 5.

## Changes Made

### 1. Backend: Dev Override Logic
**File**: `web/api/v1/ai/_actions/generate.ts` (lines 136-152)

**Before**:
```typescript
const FREE_QUIZ_LIMIT = Number(process.env.FREE_QUIZ_LIMIT || 5);
```

**After**:
```typescript
// ✅ Dev override: APP_MODE=test allows 100 quizzes for testing
const FREE_QUIZ_LIMIT =
  process.env.APP_MODE === 'test'
    ? 100
    : Number(process.env.FREE_QUIZ_LIMIT || 5);

// Optional: Log when dev override is active
if (process.env.APP_MODE === 'test') {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      context: 'usage_limits',
      message: 'Dev override active: FREE_QUIZ_LIMIT=100 (APP_MODE=test)'
    })
  );
}
```

**Logic**:
1. Check `APP_MODE` environment variable
2. If `APP_MODE === 'test'` → Set limit to 100
3. Otherwise → Use `FREE_QUIZ_LIMIT` env var (default 5)
4. Log activation in test mode for debugging

**Why Hybrid Approach**:
- Respects user's request for `APP_MODE` check
- Maintains backward compatibility with existing `FREE_QUIZ_LIMIT` env var
- Production flexibility preserved (can still override with env var)

### 2. Frontend: Dynamic Error Message
**File**: `web/src/pages/tools/Generate.tsx` (line 549)

**Before**:
```typescript
text: "Free plan limit (5 quizzes). Upgrade to continue or wait 24h."
```

**After**:
```typescript
text: payload?.message || "Free plan limit reached. Upgrade to continue or wait 24h."
```

**Why Changed**:
- Backend already sends dynamic message: `You've reached the Free plan limit of ${FREE_QUIZ_LIMIT} quizzes.`
- Hard-coded "5 quizzes" wouldn't reflect dev override (100 in test mode)
- Now automatically shows correct limit based on environment

### 3. Documentation: Usage Limits Section
**File**: `docs/core/CURRENT_STATE.md` (lines 54-58)

Added new section under Infrastructure:
```markdown
### Usage Limits
- **Free Tier**: 5 quizzes maximum (enforced in `generate.ts`)
- **Dev Override**: When `APP_MODE=test`, limit is raised to 100 quizzes for local testing
- **Backend**: Dynamic error messages reflect current limit (`${FREE_QUIZ_LIMIT}`)
- **Frontend**: Error handling uses backend message (not hard-coded)
```

## Technical Details

### Environment Variable: APP_MODE

**Already Established**: `web/src/config/appMode.ts`
```typescript
export const APP_MODE = import.meta.env.VITE_APP_MODE || "live";
export const IS_TEST = APP_MODE === "test";
```

**Backend Equivalent**: `process.env.APP_MODE`

**Values**:
- `"test"` - Development/testing mode
- `"live"` - Production mode (default)

**Existing Usage**: Already used in:
- `web/api/v1/billing/_actions/create_checkout.ts`
- `web/api/v1/billing/_actions/portal.ts`
- `web/api/stripe-webhook.ts`

### Error Flow

**Before Dev Override**:
1. User hits 5 quiz limit
2. Backend throws: `USAGE_LIMIT_REACHED` (status 402)
3. Frontend shows: "Free plan limit (5 quizzes)..."

**After Dev Override (Test Mode)**:
1. User hits 100 quiz limit (in test mode)
2. Backend throws: `USAGE_LIMIT_REACHED` (status 402)
3. Backend message: "You've reached the Free plan limit of 100 quizzes."
4. Frontend shows backend message dynamically

**After Dev Override (Live Mode)**:
1. Same as before (5 quiz limit)
2. Message shows "5 quizzes" correctly

## Safety Checklist

✅ No database schema changes
✅ No RLS policy changes
✅ No API contract changes
✅ Preserves existing `ENABLE_USAGE_LIMITS` flag
✅ Preserves existing `FREE_QUIZ_LIMIT` env var functionality
✅ Preserves error code (`USAGE_LIMIT_REACHED`, status 402)
✅ Only affects free tier users
✅ Limits still checked before OpenAI call (cost protection)
✅ Minimal code changes (low risk)
✅ Backward compatible

## Files Modified

1. `web/api/v1/ai/_actions/generate.ts` (+12 lines)
   - Dev override logic (lines 136-140)
   - Debug logging (lines 142-152)

2. `web/src/pages/tools/Generate.tsx` (1 line changed)
   - Dynamic error message (line 549)

3. `docs/core/CURRENT_STATE.md` (+4 lines)
   - Usage limits documentation (lines 54-58)

## Testing

**Local/Test Environment** (`APP_MODE=test`):
- [x] Free users can create up to 100 quizzes
- [x] Console logs: "Dev override active: FREE_QUIZ_LIMIT=100 (APP_MODE=test)"
- [x] Error message shows "100 quizzes" when limit hit

**Production Environment** (`APP_MODE=live`):
- [x] Free users limited to 5 quizzes (default)
- [x] No dev override logs in console
- [x] Error message shows "5 quizzes" when limit hit

**With Custom Env Var** (`FREE_QUIZ_LIMIT=10`, `APP_MODE=live`):
- [x] Free users limited to 10 quizzes
- [x] Error message shows "10 quizzes" dynamically

## Benefits

**For Development**:
- ✅ No need to constantly clear database during testing
- ✅ Can test quiz generation flow thoroughly
- ✅ "Unlimited" quizzes for practical purposes (100 is plenty)
- ✅ Clear logging when override is active

**For Production**:
- ✅ Automatic enforcement of 5 quiz limit
- ✅ No special configuration needed
- ✅ No risk of accidentally deploying with high limits
- ✅ Flexibility via `FREE_QUIZ_LIMIT` env var if needed

**For Users**:
- ✅ Accurate error messages showing actual limit
- ✅ No confusion from hard-coded values
- ✅ Consistent experience across environments

## Future Considerations

**Potential Enhancements**:
- Add `QUIZ_LIMIT_PAID` constant for paid tier (currently unlimited)
- Track limit reset timestamp (24h rolling window)
- Admin dashboard to view user quiz counts
- Email notification when approaching limit

**Alternative Approaches Considered**:
1. **Simple override** (`APP_MODE === 'test' ? 100 : 5`)
   - Pro: Simpler code
   - Con: Removes `FREE_QUIZ_LIMIT` env var flexibility

2. **Environment-specific files** (`.env.test`, `.env.production`)
   - Pro: Standard pattern
   - Con: More files to manage, APP_MODE already exists

3. **Feature flag** (`ENABLE_DEV_OVERRIDE`)
   - Pro: More explicit
   - Con: Extra env var when APP_MODE already distinguishes environments

**Chose hybrid approach** because it:
- Uses existing `APP_MODE` infrastructure
- Preserves `FREE_QUIZ_LIMIT` for production flexibility
- Single source of truth for environment detection

## Related Sessions

- **Session 25**: ChatGPA v1.12 UX Pivot - Results page enhancement
  - Added FollowUpFeedback component
  - Implemented retake flow
  - Fixed hard-coded error messages (complementary to this session)

## Notes

- All changes follow best practices (no hard-coded values, dynamic messages)
- Logging is structured JSON for easy parsing
- Error handling remains consistent with existing patterns
- No user-facing changes (just developer QoL improvement)
- Production behavior unchanged (5 quiz limit maintained)

---

**Session Status**: ✅ Complete
**Environment**: Local testing improved, production unchanged
**Next Steps**: Monitor dev usage, consider paid tier limits in future
