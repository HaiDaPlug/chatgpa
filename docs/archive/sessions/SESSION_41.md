# Session 41: Generation Loader Stage Progression Fix

**Date**: January 5, 2026
**Branch**: `alpha`
**Status**: ✅ Complete
**Priority**: P0-B (Premium Generation Loading Experience - Bug Fix)

---

## Problem Statement

The premium GenerationLoaderOverlay was getting stuck on "Drafting questions…" (generating stage), then the quiz suddenly appeared. The "Formatting & checking…" (validating) and "Finalizing…" (finalizing) stages were never visible, creating a "stuck then teleport" feel.

### User Experience Issue
- Stage progression showed: `sending → generating → [STUCK] → [QUIZ APPEARS]`
- Expected progression: `sending → generating → validating → finalizing → navigation`
- Undermined the premium staged progress UX built in Session 40

---

## Root Cause Analysis

### Primary Cause: Sub-Perceptual Execution Time

The `validating` and `finalizing` stages completed **faster than human perception threshold (~100ms)** AND **faster than React render cycle + Framer Motion animation transitions**.

**Evidence:**
1. **Validating stage** (1-5ms total):
   - JSON parsing
   - Synchronous response validation (res.ok, error handling)
   - UUID validation
   - Stale request guard checks

2. **Finalizing stage** (5-10ms total):
   - localStorage.setItem (~1-2ms)
   - track() telemetry call (~1-2ms)
   - Metrics computation (~1-3ms)

**Why invisible:**
- React batches setState calls in the same event loop
- Framer Motion animations take ~300ms to complete
- By the time the browser rendered "validating", code had already set stage to "finalizing" or `null`

### Secondary Cause: Early Return Paths Skip Stage Cleanup

Stale-seq early returns at 4 locations didn't reset the stage, leaving overlay stuck:
- After fetch() resolves (stale response guard)
- Before navigation (stale navigation guard)
- API error returns (2 locations)

If user cancelled/retried during validation, overlay stayed on last visible stage.

---

## Solution: Honest Minimum Display Delays

### Strategy
Add **honest minimum display durations** AFTER each milestone is achieved. This prevents visual "flickering" without lying about progress (delays happen post-milestone, not pre-milestone).

### Specification
**Min Display Durations:**
- `validating`: min 200ms
- `finalizing`: min 150ms
- **Hard cap on total added delay**: max 400ms (delay budget)

**Safety Checks:**
- Only apply delay if request still current (`localSeq` check)
- Skip delay if already navigating (`didNavigateRef` check)
- Skip delay if budget exhausted (prevents "fast gens feel slow")
- Re-check sequence after sleep (handles mid-delay cancellation)

---

## Implementation Details

### File Modified
`web/src/pages/tools/Generate.tsx`

### Changes Made

**1. Added Stage Timing Ref (Line 103)**
```typescript
const stageEnteredAtRef = useRef<number>(0);
```
Tracks when each stage was entered for minimum display duration calculation.

**2. Created Helper Functions (Lines 523-569, inside submitGenerate)**

**Delay Budget Tracking:**
```typescript
let delayBudgetUsedMs = 0;
const MAX_DELAY_BUDGET_MS = 400;
```

**Stage Tracking:**
```typescript
function setStageTracked(stage: GenerationStage | null) {
  stageEnteredAtRef.current = performance.now();
  setGenerationStage(stage);

  // Debug logging (gated behind debugGen=1)
  if (debugMode) {
    console.log(`[Stage] ${stage} @ ${(performance.now() - (metricsRef.current.t_click || 0)).toFixed(0)}ms`);
  }
}
```

**Minimum Display Duration:**
```typescript
async function ensureMinStageDisplay(minMs: number): Promise<boolean> {
  const elapsed = performance.now() - stageEnteredAtRef.current;
  const delayNeeded = Math.max(0, minMs - elapsed);

  if (delayNeeded > 0) {
    // Check delay budget
    if (delayBudgetUsedMs + delayNeeded > MAX_DELAY_BUDGET_MS) {
      if (debugMode) {
        console.log(`[Stage] Budget exhausted, skipping ${delayNeeded.toFixed(0)}ms delay`);
      }
      return true; // Budget exhausted, skip delay
    }

    // Safety: only wait if request still current and not navigating
    if (localSeq === requestSeqRef.current && !didNavigateRef.current) {
      delayBudgetUsedMs += delayNeeded;
      await new Promise(resolve => setTimeout(resolve, delayNeeded));

      // Re-check after sleep (could have been cancelled/retried)
      if (localSeq !== requestSeqRef.current) {
        if (debugMode) {
          console.log(`[Stage] Request became stale during delay, aborting`);
        }
        return false; // Stale, caller should abort
      }
    }
  }

  return true; // Safe to continue
}
```

**3. Replaced 4 Critical setGenerationStage Calls**
- Line 575: `setStageTracked('sending')`
- Line 637: `setStageTracked('generating')`
- Line 669: `setStageTracked('validating')`
- Line 724: `setStageTracked('finalizing')`

**4. Added Minimum Display Delays BETWEEN Stage Transitions**

**Before finalizing transition (Lines 718-721):**
```typescript
// P0-B: Capture t_validated timestamp
metricsRef.current.t_validated = performance.now();

// P0-B Session 41: Ensure validating stage visible for min 200ms
if (!await ensureMinStageDisplay(200)) {
  return; // Request was cancelled/retried during wait
}

// P0-B Session 41: Transition to finalizing
setStageTracked('finalizing');
```

**Before navigation (Lines 795-798):**
```typescript
// P0-B Session 41: Ensure finalizing stage visible for min 150ms
if (!await ensureMinStageDisplay(150)) {
  return; // Request was cancelled/retried during wait
}

// P0-B: Set navigation guard + clear stage before navigation
didNavigateRef.current = true;
setGenerationStage(null);
navigate(`/quiz/${quizId}`);
```

**5. Fixed Early Return Cleanup (4 Locations)**

Added `setGenerationStage(null)` to clear stuck stage, but **let `finally` block own lock/loading cleanup**:

- Line 659: Stale response guard
- Line 697: API error return
- Line 707: No quiz ID return
- Line 713: Stale navigation guard

Example:
```typescript
if (localSeq !== requestSeqRef.current) {
  console.warn('[Generation] Ignoring stale response (cancelled/retried)');
  setGenerationStage(null);  // P0-B Session 41: Clear stuck stage
  return;  // finally block will handle submissionLockRef + setLoading
}
```

**Rationale:** `finally` block (lines 775-777) already owns `submissionLockRef.current = false` and `setLoading(false)`. Duplicating cleanup in early returns risks inconsistent state or "unlock too early" edge cases.

**6. Debug Logging**
All stage transitions logged to console, permanently gated behind `debugGen=1` flag (no "forgot to remove logs" risk).

---

## Metrics Integrity

**Critical:** Existing metrics (`d_validate`, `d_navigate`) capture **real work only**. Display delays do NOT inflate metrics.

The timing still captures:
- `t_validated`: When validation actually completed
- `t_nav_start`: When navigation actually started
- `d_validate`: Real validation duration (1-5ms)
- `d_navigate`: Real navigation prep duration (5-10ms)

Display delays happen BETWEEN these timestamps and the next stage transition, preserving measurement accuracy.

---

## Impact & Metrics

### Code Changes
- **Total**: ~60 lines added/modified
- **Added**: ~55 lines (1 ref, 2 helper functions, 2 delay checks, 4 early return cleanups, debug logs)
- **Modified**: ~4 lines (setGenerationStage → setStageTracked)
- **Files touched**: 1 (`web/src/pages/tools/Generate.tsx`)

### Performance Impact
- **Max added delay**: +350-400ms total (200ms + 150ms, with hard budget cap)
- **Typical added delay**: ~350ms (if stages naturally complete <50ms)
- **% of total generation time**: <2-3% (typical gen is 10-20s)
- **Budget prevents slowdown**: Fast stages get delays, slow stages skip them

### Build Status
✅ 0 new TypeScript errors in modified code
✅ Bundle size: 629.67 kB (gzip: 176.38 kB) - no change
✅ All Session 36-40 reliability work preserved

---

## Verification Checklist

### Expected Behavior
- [x] All 4 stages visible on screen (even on fast runs)
- [x] No "stuck then teleport" feel
- [x] Validating stage displays ~200-300ms
- [x] Finalizing stage displays ~150-250ms
- [x] Cancel/retry still responsive
- [x] Early returns clear stuck stage
- [x] `finally` block owns cleanup (no duplication)

### Debug Mode Verification (`?debugGen=1`)
Expected console output:
```
[Stage] sending @ 0ms
[Stage] generating @ 5ms
[Stage] validating @ 3055ms  ← After 3s API call
[Stage] finalizing @ 3310ms  ← +255ms (validating visible 200ms + work 55ms)
[Generation Metrics] total: 3510ms, network: 3000ms, parse: 50ms...
```

### Reliability Preserved
- [x] AbortController still works
- [x] Request sequence guard still works
- [x] Navigation guard (`didNavigateRef`) still works
- [x] Submission lock still works
- [x] UI-ready latch (Session 38) still works
- [x] UUID validation (Session 36) still works
- [x] API error resilience (Session 39) still works

---

## Risk Assessment

### Low Risk ✅
- Adding cleanup to early returns (prevents bugs)
- Debug logging gated behind flag (no noise)
- Bounded delays with safety checks (no infinite waits)

### Zero Risk ✅
- No changes to abort logic, request sequence guards, navigation guards
- No changes to metrics collection (real timings still captured)
- No changes to API calls or data flow
- `finally` block owns cleanup (no duplication)

---

## Technical Decisions

### Why Honest Delays (Post-Milestone) vs Fake Progress?
- **Honest**: Delays happen AFTER real work completes, never before
- **Premium feel**: Prevents sub-perceptual stage transitions that feel like UI bugs
- **Debuggable**: Real metrics unaffected, can distinguish real work from display time
- **Bounded**: Hard budget cap prevents "fast gens feel slow"

### Why 200ms/150ms?
- **Human perception threshold**: ~100-150ms to notice visual changes
- **Animation timing**: Framer Motion transitions take ~300ms
- **Conservative**: 200ms ensures stage is visible even on slow devices
- **Budget cap**: 400ms total prevents excessive delay accumulation

### Why Delay Budget?
- Prevents pathological cases (e.g., network hiccup causes multiple retries with delays)
- Ensures fast generations stay fast (if validation takes 180ms, only add 20ms delay)
- Simple linear tracking (no complex scheduling logic)

### Why Not Skip Stages Entirely?
- Would contradict Session 40's "honest staged progress" design goal
- Would lose debugging granularity (can't see where time is spent)
- Would feel less premium (only 2 stages vs 4)
- Plan considered this option, rejected as inferior to honest delays

---

## Session 36-40 Compatibility

### Preserved Functionality
✅ **Session 36**: UUID validation prevents invalid `?attempt=` URLs
✅ **Session 37**: AnimatePresence stability (no unmount bugs)
✅ **Session 38**: UI-ready latch prevents loader snapback
✅ **Session 39**: API error resilience (JSON repair, retry logic)
✅ **Session 40**: Cancel capability, manual retry, reassurance hint, metrics

### No Regressions
- All guards remain in place
- All refs function correctly
- All early returns now properly clean up
- All metrics remain accurate
- All debug features preserved

---

## Future Considerations

### Potential Enhancements
1. **Adaptive delays**: Adjust min duration based on device performance
2. **Stage skip detection**: Alert if budget exceeded too frequently
3. **Metrics dashboard**: Track actual vs. display durations over time

### Not Needed
- Animation-only solution (doesn't address early return cleanup bug)
- Fake progress bars (violates "honest progress" principle)
- Moving work to background (adds complexity, no UX benefit)

---

## Lessons Learned

### What Worked Well
1. **Plan-first approach**: Comprehensive investigation prevented over-engineering
2. **Delay budget**: Prevents "fast gens feel slow" edge case
3. **Gated logging**: Permanent debug visibility without noise
4. **Minimal scope**: Only 4 setStageTracked calls, not global replacement

### What Could Be Better
1. Initial implementation didn't anticipate sub-perceptual execution times
2. Session 40 could have included minimum stage durations from the start
3. Early return cleanup should have been part of Session 40's guards

### Best Practices Followed
1. ✅ Honest delays (post-milestone, not pre-milestone)
2. ✅ Safety checks (sequence, navigation, abort, budget)
3. ✅ Metrics integrity (real timings separate from display delays)
4. ✅ Single ownership (finally block owns cleanup)
5. ✅ Bounded complexity (hard caps, no dynamic scheduling)

---

## Related Sessions

- **Session 36**: UUID validation, infinite loop prevention
- **Session 37**: AnimatePresence stability fix
- **Session 38**: UI-ready latch, loading screen snapback fix
- **Session 39**: API error resilience, JSON repair, retry logic
- **Session 40**: Premium generation loading experience (this builds on it)

---

**Last Updated**: January 5, 2026
**Next Session**: P1 - Grading Quality (semantic equivalence, partial credit)
