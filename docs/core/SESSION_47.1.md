# Session 47.1: P1.1 Grading Reliability - AI Output Hardening

**Date**: January 19, 2026
**Branch**: `alpha`
**Build Status**: ✅ Passing (0 TypeScript errors in P1.1 files)

---

## Problem Statement

After Session 47 shipped semantic AI grading, a follow-up issue emerged:
- `AI_GRADING_PARSE_ERROR: Invalid JSON from model` surfacing as **500 errors**
- Users see generic server error instead of actionable retry prompt
- No visibility into what the model actually returned

## Solution: AI Output Hardening

### 1. Structured Output Enforcement
- **JSON Schema**: Use OpenAI's Structured Outputs (`response_format: { type: "json_schema" }`) instead of hoping `json_object` mode behaves
- **Strict mode**: `strict: true` enforces exact schema compliance
- **Fallback**: Retry with simpler `json_object` mode if first attempt fails

### 2. Debug Logging (Gated)
- Log raw model output on parse failure for debugging
- **Gated by `GRADING_DEBUG=1`** to protect user text (student answers)
- Truncated to 500 chars max
- Never blocks grading flow

### 3. Single Retry with Stricter Constraints
- First attempt: JSON schema mode
- On failure: Retry once with `json_object` mode + stricter system prompt
- Max 2 attempts, not infinite loop

### 4. Graceful Failure UX
- **502 status** (bad gateway) instead of 500 (server error)
- **`retryable: true`** flag in response
- Client shows amber "Grading failed temporarily" banner with **Retry button**
- Never shows "Incorrect" for AI failures

---

## Files Changed

| File | Changes |
|------|---------|
| `web/api/_lib/grader.ts` | +185 lines - JSON schema, retry logic, debug logging, safer markdown fence strip |
| `web/api/v1/ai/_actions/grade.ts` | +38 lines - Catch AI_GRADING_PARSE_ERROR, return 502 with retryable |
| `web/api/v1/_middleware.ts` | +4 lines - Pass through `retryable` field |
| `web/src/pages/quiz/QuizPage.tsx` | +53 lines - gradingError state, retry UI banner |

**Total**: 4 files, ~280 lines changed

---

## Key Implementation Details

### JSON Schema Definition
```typescript
const GRADING_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          score: { type: "number" },
          band: { type: "string", enum: ["correct", "mostly_correct", "partial", "incorrect"] },
          why: { type: "string" },
          improvements: { type: "array", items: { type: "string" } },
          missing_terms: { type: "array", items: { type: "string" } },
          misconception: { anyOf: [{ type: "string" }, { type: "null" }] }
        },
        required: ["id", "score", "band", "why", "improvements", "missing_terms", "misconception"]
      }
    }
  },
  required: ["results"]
};
```

### Retry Logic Flow
```
Attempt 1: json_schema mode (strict)
  ↓ fail?
Attempt 2: json_object mode + "CRITICAL: Return ONLY valid JSON"
  ↓ fail?
Throw AI_GRADING_PARSE_ERROR → 502 + retryable: true
```

### Client Retry UI
- Amber warning banner (not red error)
- Shows error message from server
- Retry button re-calls `onSubmit()` with same payload
- Disabled during submission to prevent double-submit

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| JSON schema enforcement | Low | Fallback to json_object on retry |
| Debug logging | Low | Gated by GRADING_DEBUG=1, truncated to 500 chars |
| Single retry | Low | Max 2 attempts, not infinite |
| 502 status code | Low | Standard HTTP semantics for upstream failure |
| Markdown fence stripping | Low | Outer-only strip, preserves valid JSON |

---

## Testing Notes

### Manual Verification
1. Submit quiz with typing questions
2. Check server logs for `grade_ai_semantic` entries
3. If parse fails, verify logs show `grade_ai_parse_failed` with raw_preview (if GRADING_DEBUG=1)
4. Verify client shows "Grading failed temporarily" banner (not generic 500)

### TypeScript
- 0 errors in P1.1 files
- Pre-existing telemetry type errors unrelated to this change

---

## Follow-up Considerations

1. **Unit test**: Add mock test for retry behavior in `grading-semantic.fixture.ts`
2. **Monitoring**: Track `grade_ai_retry` and `grade_ai_parse_failed` log events in production
3. **Analytics**: `insertGradingFailure` now tracks parse failures for debugging

---

## Commit

```
Session 47.1: P1.1 Grading Reliability - AI Output Hardening

- Force JSON schema for structured outputs (not just json_object mode)
- Add single retry with stricter constraints on parse failure
- Debug logging gated by GRADING_DEBUG=1 (protects user text)
- Return 502 + retryable:true for AI parse failures
- Client shows retry banner instead of generic error

4 files changed, ~280 insertions
```
