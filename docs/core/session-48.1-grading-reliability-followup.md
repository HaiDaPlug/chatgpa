# Session 48.1: P1.2 Grading Reliability Follow-up

**Date**: January 24, 2026
**Branch**: `alpha`
**Build**: ✅ Passing (635.71 kB)

## Issues Fixed

| Issue | Root Cause | Fix |
|-------|------------|-----|
| `/rest/v1/attempts` 404 | Breadcrumbs.tsx queried wrong table name | Changed `"attempts"` → `"quiz_attempts"` |
| AI grading 0/7 success | `max_tokens: 256` too low → truncated JSON | Increased to 512 (first attempt), 768 (retry) |
| Retry ineffective | Both attempts used same 256 limit | Smart retry with higher token limit + stricter prompt |

## Files Changed

| File | Changes |
|------|---------|
| `web/src/components/Breadcrumbs.tsx` | Line 43: `"attempts"` → `"quiz_attempts"` |
| `web/api/_lib/grader.ts` | Added `STRICT_RETRY_PROMPT`, updated token limits (512/768), added debug logging |

## Key Changes in grader.ts

1. **Token limits**: `256` → `isRetry ? 768 : 512`
2. **Stricter prompts**: Concise JSON-only instructions, even shorter on retry
3. **Debug logging**: Raw output preview under `GRADING_DEBUG=1` (truncated 4KB)

## Verification

- [ ] `/attempts/:id` loads without 404
- [ ] 7-question quiz grades ≥5/7 (not 0/7)
- [ ] Latency drops from ~38s to ~25s
- [ ] Failed questions show "Ungraded" with retry option
