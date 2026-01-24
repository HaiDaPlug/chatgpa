# Session 48: P1.2 Grading Reliability + Quiz Refresh Bug

**Date**: 2026-01-23
**Status**: Complete

## Summary

Two fixes for grading reliability and quiz UX:
1. Replace batch AI grading with per-question grading + partial success
2. Fix quiz page refresh jumping to wrong question

## Changes

### Grading Reliability (grader.ts, grade.ts)

**Problem**: Batch grading with 7+ questions exceeded token limit (1024), causing JSON truncation → 502 errors.

**Solution**:
- New `aiSemanticGradeSingle()` for per-question grading (256 tokens each)
- Concurrency limiter (`withConcurrencyLimit`) with limit=2
- Partial success: failed questions get `score: null` (Ungraded sentinel)
- Always return HTTP 200 with best-effort results
- Percent calculation excludes ungraded questions

**Files**:
- `web/api/_lib/grader.ts` - Per-question grading, concurrency limiter, partial success handling
- `web/api/v1/ai/_actions/grade.ts` - Removed 502 error handling

### Quiz Refresh Bug (QuizPage.tsx)

**Problem**: B1 effect overwrote localStorage-restored `currentIndex` on page refresh.

**Solution**:
- Added `restoredIndexRef` to track if localStorage restored position
- B1 effect checks ref before auto-advancing to first unanswered
- Added `displayQuestions` to effect deps (stale closure fix)

**File**: `web/src/pages/QuizPage.tsx`

## Testing

```bash
npx tsx web/api/_lib/__tests__/grading-semantic.fixture.ts
```

- All 4 regression tests pass
- Partial failure test verifies `score: null` sentinel

## Verification

**Grading**:
1. Create quiz with 7+ short-answer questions
2. Submit → no 502, all graded in <15s

**Quiz Refresh**:
1. Start quiz, answer Q1, navigate to Q3
2. Refresh → stays on Q3 (not Q2)
