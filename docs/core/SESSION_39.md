# Session 39: API Non-JSON Response Error Fix (Defensive Resilience)

**Date**: January 3, 2026
**Branch**: `alpha`
**Status**: ✅ Complete - Production-Ready
**Build**: ✅ Passing (0 TypeScript errors, 619.02 kB bundle)

---

## Problem Statement

**Issue**: Quiz generation occasionally failed with "Non-JSON response from model" error, providing zero diagnostic context.

**Error observed**:
```
POST /api/v1/ai?action=generate_quiz 400 (Bad Request)
code: 'SCHEMA_INVALID', message: 'Non-JSON response from model'
```

**Root causes identified**:
1. **Evidence loss**: `ai-router.ts:339` used `?? "{}"` fallback → lost original response
2. **Zero diagnostics**: No logging of finish_reason, tokens, content preview on parse failure
3. **Wrong error attribution**: Classified as SCHEMA_INVALID (user input fault) instead of MODEL_* (upstream fault)
4. **No recovery**: Common fixable patterns (markdown fences, leading prose) not handled
5. **No truncation detection**: Token usage not logged to diagnose max_tokens issues

---

## Solution: Bulletproof Error Handling

**Core principles**:
1. **Never lose truth** - Log raw content preview, never fallback to `"{}"`
2. **Attempt repair** - Strip markdown fences, extract JSON from leading prose
3. **Classify errors** - Empty vs non-JSON vs truncation vs refusal
4. **Single retry** - Automatic recovery from transient failures
5. **User-friendly messages** - "AI returned invalid response. Retry." (not "Bad Request")

---

## Implementation

### Phase 1: Router Layer (ai-router.ts)

**Added helper functions** (~81 lines):

```typescript
/**
 * Classify content pattern for diagnostics
 */
function classifyContent(raw: string): string {
  if (!raw || raw.trim() === "") return "empty";
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return "json_like";
  if (trimmed.startsWith("```")) return "markdown_fence";
  if (trimmed.match(/^(I can't|I cannot|Sorry|As an AI)/i)) return "refusal";
  return "prose";
}

/**
 * Extract JSON from common wrapper patterns
 * Handles objects {...}, arrays [...], leading prose
 */
function extractJSON(raw: string): string | null {
  // Pattern 1: Markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {}
  }

  // Pattern 2: First {...} or [...] block (handles "Sure! Here's the JSON: {...}")
  const openBraceIdx = raw.indexOf('{');
  const openBracketIdx = raw.indexOf('[');

  let startIdx = -1;
  let openChar = '';
  let closeChar = '';

  if (openBraceIdx !== -1 && (openBracketIdx === -1 || openBraceIdx < openBracketIdx)) {
    startIdx = openBraceIdx;
    openChar = '{';
    closeChar = '}';
  } else if (openBracketIdx !== -1) {
    startIdx = openBracketIdx;
    openChar = '[';
    closeChar = ']';
  }

  if (startIdx === -1) return null;

  // Extract from first open to matching close
  let depth = 0;
  for (let i = startIdx; i < raw.length; i++) {
    if (raw[i] === openChar) depth++;
    if (raw[i] === closeChar) depth--;
    if (depth === 0) {
      const candidate = raw.slice(startIdx, i + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {}
      return null;
    }
  }

  return null;
}
```

**Replaced content extraction** (lines 339-346 → 103 lines):
- Removed `?? "{}"` fallback
- Added empty response detection with comprehensive logging
- Try parse as-is (fast path)
- Attempt repair with `extractJSON()`
- Log repair success
- On failure: classify pattern, detect truncation, log diagnostics, throw typed error

**New error types**:
- `MODEL_EMPTY_RESPONSE` (502) - Empty/missing content
- `MODEL_NON_JSON` (502) - Invalid JSON after repair attempt

**Logging includes**:
- `finish_reason` - Critical for truncation detection
- `usage` (prompt_tokens, completion_tokens)
- `max_tokens_param` - Confirms limit used
- `raw_preview` (300 chars max) - Safe content preview
- `content_pattern` - Classification (empty/json_like/markdown_fence/refusal/prose)
- `truncation_likely` - Boolean flag
- `choice_message_keys` - Validates response structure

### Phase 2: Action Layer (generate.ts)

**Added randomUUID import**:
```typescript
import { randomUUID } from 'node:crypto';
```

**Wrapped router call with retry logic** (lines 190-203 → 59 lines):
```typescript
let routerResult;
let retryAttempted = false;
const parentRequestId = request_id;

// Feature flag: enable/disable retry (defaults enabled)
const ENABLE_MODEL_RETRY = process.env.ENABLE_MODEL_RETRY !== 'false';

while (true) {
  try {
    // Use new request_id for retry to avoid log confusion
    const currentRequestId = retryAttempted ? randomUUID() : parentRequestId;

    routerResult = await generateWithRouter({
      task: 'quiz_generation',
      context: {
        notes_length: notes_text.length,
        question_count: quizConfig.question_count,
        request_id: currentRequestId,
        config: quizConfig
      }
    });
    break; // Success
  } catch (routerError: any) {
    const isTransientModelError =
      routerError.code === 'MODEL_EMPTY_RESPONSE' ||
      routerError.code === 'MODEL_NON_JSON';

    // Single retry for transient errors (if feature enabled)
    if (isTransientModelError && !retryAttempted && ENABLE_MODEL_RETRY) {
      retryAttempted = true;
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        parent_request_id: parentRequestId,
        user_id,
        event: 'RETRYING_GENERATION',
        reason: routerError.code,
        message: 'Retrying after transient model error (new request_id will be generated)'
      }));
      continue; // Retry once
    }

    // Map to user-friendly error after retry exhausted
    if (isTransientModelError) {
      throw {
        code: 'MODEL_INVALID_OUTPUT',
        message: 'AI returned an invalid response after retry. Please try generating again.',
        status: 502
      };
    }

    throw routerError;
  }
}
```

**Updated JSON.parse try/catch** (lines 276-285 → 17 lines):
- Added belt-and-suspenders logging (should never trigger)
- Changed status 400 → 502
- Changed code SCHEMA_INVALID → MODEL_INVALID_OUTPUT
- Logs content_preview (200 chars max)

---

## Files Modified

1. **`web/api/_lib/ai-router.ts`** (+184 lines)
   - Added `classifyContent()` helper (12 lines)
   - Added `extractJSON()` helper (69 lines)
   - Replaced executeCall content extraction (103 lines net change)

2. **`web/api/v1/ai/_actions/generate.ts`** (+60 lines)
   - Added `randomUUID` import (1 line)
   - Wrapped router call with retry logic (59 lines net change)
   - Updated JSON.parse try/catch (17 lines net change)

**Total**: ~244 lines added

---

## Impact

### User Experience
**Before**:
- Error: "Bad Request" (400)
- No recovery
- Zero diagnostic context

**After**:
- Error: "AI returned an invalid response after retry. Please try generating again." (502)
- Automatic retry on transient failures
- Comprehensive logging for debugging

### Reliability Improvements
- ✅ **Auto-repair**: Handles markdown fences, leading prose, objects + arrays
- ✅ **Single retry**: Recovers from transient OpenAI API issues
- ✅ **Truncation detection**: Logs finish_reason='length' + token usage
- ✅ **Pattern classification**: Empty/json_like/markdown_fence/refusal/prose

### Observability Improvements
- ✅ **Every failure logged** with finish_reason, usage, pattern, preview
- ✅ **Repair attempts logged** when successful
- ✅ **Choice.message keys logged** on empty response
- ✅ **Request tracing**: parent_request_id preserved across retries

---

## Key Safety Features

1. **No `"{}"` fallback** - Preserves truth, prevents downstream Zod errors
2. **JSON extraction scans raw string** - Handles "Sure! Here's the JSON: {...}"
3. **Retry uses new request_id** - Clean logs, traceable via parent_request_id
4. **Retry is feature-flagged** - `ENABLE_MODEL_RETRY` env var (defaults enabled)
5. **Log previews capped** - Router: 300 chars, Action: 200 chars (privacy/cost)
6. **Status 502** - Correct attribution (upstream failure, not user fault)

---

## Testing

### Build Status
```bash
✓ 2842 modules transformed
✓ built in 5.30s
Bundle size: 619.02 kB (gzip: 173.66 kB)
0 TypeScript errors
```

### Frontend Compatibility
- ✅ Generate.tsx:535 uses `!res.ok` + `payload?.code` (status-agnostic)
- ✅ `MODEL_INVALID_OUTPUT` falls through to generic error message
- ✅ No breaking changes to API contracts

### Edge Cases Handled
1. **Empty content** → Logged with choice.message keys + finish_reason
2. **Markdown fences** → Auto-extracted and validated
3. **Wrapped JSON** → First {...} or [...] block extracted
4. **Truncation** → Detected via finish_reason='length' + missing closing bracket
5. **Refusal** → Classified via pattern matching
6. **Transient failures** → Single retry with new request_id

---

## Scope Boundaries

**What this PR does**:
- ✅ Resilience + observability improvements
- ✅ Error classification and recovery
- ✅ Comprehensive diagnostic logging

**What this PR does NOT do**:
- ❌ No prompt changes
- ❌ No model parameter changes
- ❌ No schema modifications

---

## Lessons Learned

### 1. Preserve Truth
Never fallback to fake data (`"{}"`) - it converts upstream failures into downstream validation errors and loses all diagnostic context.

### 2. Classify Before Throwing
Pattern classification (empty/json_like/markdown_fence/refusal/prose) enables targeted fixes and helps identify systemic issues.

### 3. Repair Common Patterns
Most "non-JSON" responses are fixable:
- Markdown fences: ` ```json {...} ``` `
- Leading prose: "Sure! Here's the JSON: {...}"
- Trailing text after JSON

### 4. Truncation Is Common
Always log finish_reason + token usage. Truncation (finish_reason='length') is a frequent cause of invalid JSON.

### 5. Request Tracing
Generate new request_id for retries but preserve parent_request_id for tracing. Prevents log confusion while maintaining trace chain.

---

## Next Steps

### Immediate
1. **Monitor production logs** for MODEL_EMPTY_RESPONSE / MODEL_NON_JSON patterns
2. **Verify retry behavior** - Should see RETRYING_GENERATION events followed by success
3. **Check repair patterns** - Should see JSON_REPAIR_SUCCEEDED for wrapped content

### Medium-Term (P0-B)
- World-class loading states with honest progress indicators
- Generation perceived speed improvements
- Cancel + Retry buttons in UI

### Long-Term (P1)
- Grading quality improvements (semantic equivalence, partial credit)
- Generator quality (nuance, variety, case questions)

---

## Related Documentation

- **Session 38**: [SESSION_38.md](./SESSION_38.md) - UI-ready latch fix
- **Plan**: [calm-whistling-plum.md](../../.claude/plans/calm-whistling-plum.md) - Implementation plan
- **Architecture**: [Architecture.md](./Architecture.md) - System design

---

**Last Updated**: January 3, 2026
**Next Session**: Production monitoring + P0-B planning
**Build Status**: ✅ Passing (0 TypeScript errors, 619.02 kB bundle)
