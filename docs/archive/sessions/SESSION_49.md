# Session 49: P1.3 Teacher-Strict Semantic Grading

**Date**: January 24, 2026
**Branch**: `alpha`
**Status**: Complete

---

## Summary

Updated the semantic grading prompt to enforce teacher-strict grading rules. Term-only answers without explanation are now capped at `partial` (≤0.74). The grader now rewards understanding over keyword hits.

---

## Problem

Term-only/shallow answers could score "Correct" (e.g., listing "förnekelse" without explaining what it is). This undermined trust in the grading system.

## Solution

### 1. Updated System Prompt (Teacher-Strict)
**File**: `web/api/_lib/grader.ts` (lines 218-229)

Core principles:
1. Grade understanding, not keyword matching
2. Penalize shallow answers that only list terms without showing understanding
3. Follow instruction precisely (e.g., "give ONE example")
4. Accept paraphrases but don't falsely claim items are "in the reference"
5. Keep feedback concise, specific, actionable

### 2. New Per-Question Payload
**File**: `web/api/_lib/grader.ts` (lines 232-268)

Scoring rubric:
- Understanding & correctness: 0.00–0.70
- Completeness: 0.00–0.20
- Instruction compliance: 0.00–0.10

Strictness rules:
- Term-only answer → cap at 0.74 (partial)
- Wrong concept → score ≤ 0.30
- Missing explanation → Swedish improvement hint

### 3. Band/Score Consistency Validation
**File**: `web/api/_lib/grader.ts` (lines 329-339)

Post-parse validation ensures band matches score thresholds:
- `correct`: 0.90–1.00
- `mostly_correct`: 0.75–0.89
- `partial`: 0.40–0.74
- `incorrect`: 0.00–0.39

### 4. Updated Test Fixtures
**File**: `web/api/_lib/__tests__/grading-semantic.fixture.ts`

Added 4 teacher-strict test cases:
- `ts1`: Term-only → partial (0.40-0.74)
- `ts2`: Term + explanation → mostly_correct/correct (0.75-1.0)
- `ts3`: Valid paraphrase → high score
- `ts4`: Wrong concept → incorrect (0.00-0.39)

---

## Files Changed

| File | Changes |
|------|---------|
| `web/api/_lib/grader.ts` | +60 lines (prompts, validation) |
| `web/api/_lib/__tests__/grading-semantic.fixture.ts` | +80 lines (teacher-strict tests) |

---

## Prompt Diff

### Before (systemPrompt)
```
Grade this answer. Return ONLY this JSON:
{"score":N,"band":"X","why":"1 sentence","improvements":["max 2"],"missing_terms":["max 3"],"misconception":null}

Bands: correct (0.90-1.0), mostly_correct (0.75-0.89), partial (0.30-0.74), incorrect (0-0.29)
No markdown. No extra keys. No commentary.
```

### After (systemPrompt)
```
You are a strict but fair teacher grading a student's answer using a reference answer as guidance.

Core principles:
1) Grade understanding, not keyword matching.
2) Penalize shallow answers that only list terms without showing understanding when the question implies explanation.
3) Follow the question's instruction precisely (e.g., "give ONE example", "name and explain three", "compare", "define").
4) Accept correct paraphrases and valid alternatives even if not in the reference, but NEVER claim an item is "in the reference" unless it is explicitly present in the reference answer text.
5) Keep feedback concise, specific, and actionable.

Output must be VALID JSON only (no markdown, no extra text). Keep fields short.
Language: Swedish.
```

---

## Verification

1. **Fixture tests**: All 12 tests pass
   ```bash
   npx tsx web/api/_lib/__tests__/grading-semantic.fixture.ts
   ```

2. **Build**: Passes (635.71 kB)

3. **Manual browser test**:
   - Submit term-only answer → expect partial (≤0.74)
   - Submit term + explanation → expect mostly_correct or correct (≥0.75)

---

## Band Threshold Change

Changed `partial` floor from 0.30 to 0.40:
- 0.30-0.39 is "barely attempted" territory → now `incorrect`
- 0.40+ shows some understanding → `partial`

---

## Rollback

If issues arise:
1. Revert `systemPrompt` and `userContent` to minimal versions
2. Remove post-parse band/score validation
3. JSON schema unchanged → no breaking changes
