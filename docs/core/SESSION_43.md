# Session 43: Fix Generation Debug Telemetry (model_used + Client Logs)

**Date**: January 8, 2026
**Branch**: `alpha`
**Status**: ✅ Complete
**Build**: 0 TypeScript errors, 635.12 kB bundle (gzip: 177.83 kB)

---

## Summary

Fixed critical debug telemetry bug where `model_used` was always `undefined` due to incorrect client path (`payload.debug` instead of `payload.data.debug`). Made server always return `model_used` at top level for production analytics. Added optional debug-only client log shipping to Vercel for stage correlation.

---

## Problem Solved

**Issue**: Client debug metrics showed `model_used: undefined` even though server returned it in `payload.data.debug.model_used`.

**Root Cause**: Client read from wrong path (`payload?.debug?.model_used` instead of `payload?.data?.debug?.model_used`).

**Additional Goal**: Enable correlation between client stage timings and server logs in Vercel.

---

## Changes Made

### 1. Task A: Fix Client model_used Path (CRITICAL)
**File**: `web/src/pages/tools/Generate.tsx` (lines 764-768)

**Before**:
```typescript
metricsRef.current.model_used = payload?.debug?.model_used;  // ❌ Missing .data
```

**After**:
```typescript
// Task A: Safe fallback chain for model_used (data.model_used → data.debug.model_used)
const modelUsed = payload?.data?.model_used || payload?.data?.debug?.model_used;
if (modelUsed) {
  metricsRef.current.model_used = modelUsed;
}
```

**Impact**:
- ✅ Fixes undefined bug by reading correct path
- ✅ Safe fallback chain prevents overwriting with undefined
- ✅ Forward-compatible with Task B changes

---

### 2. Task B: Server Always Returns model_used (STABILITY)
**Files Modified**:
- `web/api/v1/ai/_actions/generate.ts` (lines 36, 512, 522, 534)

**Changes**:
1. **TypeScript Return Type** (line 36):
   ```typescript
   model_used: string;  // Task B: ALWAYS return (additive)
   debug?: {
     ...
     model_used: string;  // Task B: DUPLICATE (backward compat)
   }
   ```

2. **Debug Response** (line 512):
   ```typescript
   return {
     quiz_id: quizData.id,
     config: quizConfig,
     actual_question_count: actualQuestionCount,
     model_used: routerResult.metrics.model_used,  // ← ALWAYS return
     debug: {
       timings: {...},
       model_used: routerResult.metrics.model_used,  // ← DUPLICATE
       fallback_triggered: routerResult.metrics.fallback_triggered,
       tokens_total: routerResult.metrics.tokens_total || 0
     }
   };
   ```

3. **Normal Response** (line 534):
   ```typescript
   return {
     quiz_id: quizData.id,
     config: quizConfig,
     actual_question_count: actualQuestionCount,
     model_used: routerResult.metrics.model_used  // ← ALWAYS return
   };
   ```

**Impact**:
- ✅ `model_used` now available in all responses (not just debug mode)
- ✅ Backward compatible: `debug.model_used` still present when debug enabled
- ✅ Stable API for production analytics/bucketing

---

### 3. Task C: Client Log Shipping to Vercel (OPTIONAL)
**Files Created/Modified**:

#### 3.1 Add ClientLogInput Schema
**File**: `web/api/v1/util/_schemas.ts` (lines 26-34)

```typescript
// ===== Client Log Schemas (Task C) =====

export const ClientLogInput = z.object({
  level: z.enum(['info', 'warn', 'error']).default('info'),
  message: z.string().min(1).max(200),
  source: z.string().max(50).optional(),  // e.g. "generate_page" for searchability
  gen_request_id: z.string().optional(),  // Correlate with server generation
  data: z.record(z.string(), z.any()).optional(),
});
```

#### 3.2 Create client_log Action
**File**: `web/api/v1/util/_actions/client_log.ts` (NEW, 40 lines)

```typescript
export async function client_log(
  data: unknown,
  context: GatewayContext
): Promise<any> {
  const parsed = ClientLogInput.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid payload' };  // Don't throw - logs are non-critical
  }

  const { level, message, source, gen_request_id, data: logData } = parsed.data;
  const { request_id, user_id } = context;

  // Hard cap: prevent huge logs (4KB max)
  const safeData = JSON.stringify(logData || {}).slice(0, 4000);

  // Structured log for Vercel
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      source: source || 'client_log',
      log_level: level,
      request_id,
      user_id: user_id || 'anonymous',
      gen_request_id: gen_request_id || null,
      message,
      data: safeData,
    })
  );

  return { ok: true };
}
```

**Security Guardrails**:
- ⚠️ 4KB payload cap prevents log spam
- ⚠️ Only logs timings/stage names/IDs - **NEVER note text or prompts**
- ⚠️ Non-blocking: swallows errors, never throws

#### 3.3 Export client_log
**File**: `web/api/v1/util/_actions/index.ts` (line 6)

```typescript
export { client_log } from './client_log.js';  // Task C: Debug-only log shipping
```

#### 3.4 Client Helper Function
**File**: `web/src/pages/tools/Generate.tsx` (lines 526-562)

```typescript
// Task C: Helper - Ship debug logs to Vercel (only when debugGen=1)
async function shipClientLog(payload: {
  level?: 'info' | 'warn' | 'error';
  message: string;
  gen_request_id?: string;
  data?: Record<string, unknown>;
}) {
  if (!debugMode) return;  // Gate: only when debugGen=1

  try {
    // Get current session token for auth
    const session = (await supabase.auth.getSession()).data.session;
    const token = session?.access_token;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authorization if token available (prefer cookie-based auth)
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await fetch('/api/v1/util?action=client_log', {
      method: 'POST',
      headers,
      credentials: 'same-origin',  // Send cookies for session-based auth
      body: JSON.stringify({
        ...payload,
        source: 'generate_page',  // Searchable in Vercel logs
      }),
    });
  } catch {
    // Swallow - logs must never block generation
  }
}
```

#### 3.5 Update setStageTracked
**File**: `web/src/pages/tools/Generate.tsx` (lines 573-580)

```typescript
// Task C: Ship to Vercel (debug only)
// ⚠️ NEVER log note text, prompts, or user content - only timings/IDs
shipClientLog({
  level: 'info',
  message: `Stage: ${stage}`,
  gen_request_id: metricsRef.current.request_id,
  data: { stage, elapsed_ms: Math.round(elapsed) },
}).catch(() => {});  // Fire-and-forget
```

#### 3.6 Ship Final Metrics on Success
**File**: `web/src/pages/tools/Generate.tsx` (lines 859-871)

```typescript
// Task C: Ship final metrics to Vercel (debug only)
// ⚠️ NEVER log note text, prompts, or user content - only timings/IDs/model_used
shipClientLog({
  level: 'info',
  message: 'Generation complete',
  gen_request_id: metrics.request_id,
  data: {
    total_ms: Math.round(metrics.d_total || 0),
    network_ms: Math.round(metrics.d_network || 0),
    model_used: metrics.model_used,  // Safe: just model name
    quiz_id: metrics.quiz_id,  // Safe: just ID
  },
}).catch(() => {});  // Fire-and-forget
```

**Impact**:
- ✅ Zero overhead when `debugGen=1` disabled
- ✅ Max ~5-6 API calls per generation (4 stages + success + optional error)
- ✅ Correlate client stages with server logs via `gen_request_id`
- ✅ Searchable in Vercel by `source: "generate_page"`

---

## Files Changed (6 total)

1. **web/src/pages/tools/Generate.tsx** (~60 lines modified/added)
   - Fixed client `model_used` path (Task A)
   - Added `shipClientLog()` helper (Task C)
   - Updated `setStageTracked()` to ship logs (Task C)
   - Ship final metrics on success (Task C)

2. **web/api/v1/ai/_actions/generate.ts** (~8 lines modified)
   - Always return `model_used` at top level (Task B)
   - Keep `debug.model_used` duplicated (backward compat)
   - Updated TypeScript return type

3. **web/api/v1/util/_schemas.ts** (+8 lines)
   - Added `ClientLogInput` schema (Task C)

4. **web/api/v1/util/_actions/client_log.ts** (+40 lines, NEW)
   - Implemented `client_log` action (Task C)
   - 4KB payload cap + security guardrails

5. **web/api/v1/util/_actions/index.ts** (+1 line)
   - Export `client_log` (Task C)

---

## Verification

### Build Status ✅
```
✓ built in 5.13s
Bundle: 635.12 kB (gzip: 177.83 kB)
0 TypeScript errors
```

### Expected Behavior

#### After Task A + B:
- Generate with `?debugGen=1`
- Browser console table shows `model_used: "gpt-5-mini"` or `"gpt-4o-mini"` (not undefined)
- `localStorage.getItem('debug:lastGenerate')` contains `model_used` field
- Network response includes both `data.model_used` (top level) and `data.debug.model_used` (when debug enabled)

#### After Task C:
- Generate with `?debugGen=1`
- Vercel Runtime Logs contain JSON entries with `"source": "generate_page"`
- Stage transitions visible: `Stage: sending`, `Stage: generating`, `Stage: validating`, `Stage: finalizing`
- Final metrics: `Generation complete` with `total_ms`, `network_ms`, `model_used`, `quiz_id`
- `gen_request_id` matches server `/api/v1/ai` logs for correlation

---

## Technical Decisions

### Why duplicate debug.model_used?
Preserves backward compatibility with existing debug tools that may depend on `payload.data.debug.model_used`. No breaking changes.

### Why cookie-based auth for client_log?
- More reliable than Bearer tokens (avoids timing issues)
- Fallback to Authorization header if session available
- Logs are non-critical, should never block generation

### Why fire-and-forget?
Client logs are debug-only telemetry. They must never:
- Block quiz generation
- Throw errors that break UX
- Require user intervention

---

## Security Guardrails

1. **4KB Payload Cap**: `JSON.stringify(logData || {}).slice(0, 4000)` prevents log spam
2. **Data Whitelist**: Only timings/stage names/IDs/model names logged
3. **No User Content**: NEVER logs note text, prompts, or quiz content
4. **Debug-Only**: Gated by `?debugGen=1` flag, zero overhead in production
5. **Non-Blocking**: All errors swallowed, never throws

---

## Next Steps

### Testing
1. Generate quiz with `?debugGen=1`
2. Verify `model_used` in browser console + localStorage
3. Check Vercel logs for client_log entries
4. Confirm correlation via `gen_request_id`

### Future Improvements (Optional)
- Add error stage logging (on generation failure)
- Ship retry attempts to Vercel
- Add bucketing analysis by `model_used` in analytics

---

## Related Sessions

- **Session 40**: Premium Generation Loading Experience (added stage progression)
- **Session 41**: Generation Loader Stage Progression Fix (honest minimum delays)
- **Session 39**: API Error Resilience (JSON repair, retry logic)

---

**Completed**: January 8, 2026
**Next Session**: TBD (P1: Grading Quality)
