# Session 46: Fix Analytics Insertion Failures

**Date:** January 12, 2026
**Branch:** `alpha`
**Status:** ✅ Complete

---

## Problem

Analytics inserts were failing with two errors:
1. **RLS Error 42501** (Primary): "new row violates row-level security policy for table 'analytics'"
2. **TypeError: fetch failed** (Secondary): Intermittent network failures

Main flows (generate/grade) still succeeded due to fire-and-forget pattern, but analytics data was not being collected.

---

## Root Cause

**RLS Error 42501:**
- Analytics functions used anon client WITHOUT user token
- RLS policy requires `user_id = auth.uid()`
- Without token, `auth.uid()` returns NULL → policy blocks insert

**TypeError: fetch failed:**
- Multiple Supabase client instances created per request
- Connection pool churn under load
- Missing env diagnostics made debugging difficult

---

## Solution

### 1. Service Role Client
Replaced anon client with service role client for analytics inserts:
- Service role bypasses RLS (appropriate for server-side analytics)
- Module-level caching reduces connection overhead
- Detailed env diagnostics (logs missing vars + deployment env)

### 2. Log Level Improvements
- Changed `console.error` → `console.warn` for failures
- Gated success logs behind `ANALYTICS_DEBUG=1` (prevents prod spam)
- Single log per failure (no double-logging)

### 3. Shared Helper
Created `analytics-admin.ts` with `getAnalyticsAdminClient()`:
- No duplication between files (prevents drift)
- Clear naming prevents accidental reuse
- Warns once per cold start if env missing

---

## Files Changed (3 files, ~80 lines net)

### Created
- **`web/api/_lib/analytics-admin.ts`** (50 lines)
  - Shared `getAnalyticsAdminClient()` helper
  - Module-level client caching
  - Detailed env diagnostics

### Modified
- **`web/api/_lib/analytics-service.ts`**
  - Added import of `getAnalyticsAdminClient`
  - Updated `insertGenerationAnalytics()`: service role + warn logs + gated success
  - Updated `insertGenerationFailure()`: same pattern with error logging

- **`web/api/_lib/grading-analytics.ts`**
  - Added import of `getAnalyticsAdminClient`
  - Updated `insertGradingAnalytics()`: service role + warn logs + gated success
  - Updated `insertGradingFailure()`: same pattern with error logging

---

## Key Improvements

1. **Shared Helper** - No code duplication, prevents future drift
2. **Module Caching** - Reduces connection pool churn
3. **Log Levels** - WARN for failures (not ERROR), gated success logs
4. **Env Diagnostics** - Logs `missing_env_vars` + `deployment_env` once per cold start
5. **Thin Safety Catch** - Prevents unhandled promise rejections
6. **Security Audit** - Verified no user text in analytics payloads

---

## Security

✅ **Service role client is safe because:**
- Server-side only (`web/api/_lib/` never bundled to client)
- Helper only used for analytics INSERT operations
- Named `getAnalyticsAdminClient()` to prevent accidental reuse
- No user input in queries (all server-generated)
- Analytics are insert-only (no UPDATE/DELETE)
- User-facing operations still use anon+RLS client

✅ **Analytics payloads contain NO sensitive data:**
- Only IDs (UUIDs), timings (numbers), model names (strings), numeric metrics
- No note contents, question prompts, user answers, or AI feedback text

---

## Testing

### TypeScript Check
```bash
cd web && npx tsc --noEmit
```
- ✅ 0 new errors introduced
- 36 pre-existing errors (unrelated to analytics)

### Expected Outcomes

**Before:**
- ❌ RLS error 42501 spamming logs
- ❌ ERROR level logs for non-critical feature
- ❌ No analytics rows in database

**After:**
- ✅ No RLS errors (service role bypasses policy)
- ✅ Analytics rows successfully inserted
- ✅ WARN level logs only (low noise)
- ✅ Success logs gated (no prod spam)
- ✅ Better diagnostics for missing env

---

## Notes

- `TypeError: fetch failed` may still occur intermittently (network issues), but will be:
  - Easier to diagnose (env check logs deployment details)
  - Logged at WARN level (not ERROR)
  - Never blocking main flows (fire-and-forget + thin catch)

- Main flows (generate quiz, grade quiz) unchanged and still succeed regardless of analytics status

- Success logs only visible when `ANALYTICS_DEBUG=1` is set (prevents production log spam)

---

## References

- Plan: `C:\Users\ÄGARE\.claude\plans\humble-jumping-lerdorf.md`
- Related: Session 43 (model_used telemetry), Session 44 (model selection visibility)
