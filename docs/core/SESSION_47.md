# Session 47: P1 Grading Quality - Score Bands + Semantic AI Grading

**Date:** January 16, 2026
**Branch:** `alpha`
**Status:** ✅ Complete

---

## Problem

Grading was overly strict - users saw "Incorrect" for answers that were semantically correct paraphrases. This is a trust leak: freeform answers marked incorrect even when copied/pasted from notes.

**Example:**
- Reference: "Repression is pushing threatening thoughts into the unconscious"
- User answer: "When you push bad thoughts into your unconscious mind"
- Old result: ❌ Incorrect (Jaccard < 0.6)
- New result: ✅ Mostly Correct (AI semantic grading: 0.92)

---

## Solution

### 1. Frontend: Score Band Labels
Changed verdict labels from binary (Correct/Incorrect) to granular score bands:
- **≥ 0.90**: Correct (green)
- **0.70-0.89**: Mostly Correct (green, lighter)
- **0.30-0.69**: Partial (amber)
- **< 0.30**: Incorrect (red)
- **null/undefined**: Ungraded (gray)

### 2. Backend: Hybrid AI Semantic Grading
Cost-guarded approach that minimizes AI calls:
- **Gate 1**: Exact normalized match → score 1.0, skip AI
- **Gate 2**: Jaccard ≥ 0.6 → score 0.85, skip AI (shows as "Mostly Correct")
- **Gate 3**: AI semantic grading for non-obvious cases

### 3. Strict `correct` Boolean Mapping
- `correct: true` only when score ≥ 0.90
- Backward compatible: existing filters/stats/streaks that assume `correct === perfect` still work

### 4. Regression Test Fixture
Mocked Freud defense mechanisms test with 4 cases:
- Q1: Paraphrase → expect ≥ 0.90
- Q2: Exact copy → expect ≥ 0.90
- Q5: Wrong answer → expect 0.0-0.29
- Q7: Partial (missing terminology) → expect 0.70-0.90

---

## Files Changed (4 files, ~200 lines)

### Modified
- **`web/src/lib/grader.ts`** (~10 lines)
  - Added `score?: number` to BreakdownItem type
  - Added `missing_terms?: string[]` to BreakdownItem type

- **`web/api/_lib/grader.ts`** (~100 lines)
  - Added `clampScore()` helper for edge case prevention
  - Added `AIGradingResult` interface with typed fields
  - Implemented `aiSemanticGradingBatch()` with structured JSON validation
  - Hybrid grading flow: exact match → Jaccard gate → AI semantic
  - Score field on all breakdown items (MCQ and short)
  - AI JSON shape validation with retryable errors

- **`web/src/components/attempt/AttemptReview.tsx`** (~50 lines)
  - Added `ScoreBand` type: 'correct' | 'mostly_correct' | 'partial' | 'incorrect' | 'ungraded'
  - Added `getScoreBand()` helper with score clamping
  - Updated `StatusBadge` to support all 5 bands with proper styling
  - Backward compatible fallback: `breakdown.score ?? (breakdown.correct ? 1 : 0)`

### Created
- **`web/api/_lib/__tests__/grading-semantic.fixture.ts`** (~305 lines)
  - Mocked AI responses for deterministic testing
  - Freud defense mechanisms test cases
  - Run with: `npx tsx web/api/_lib/__tests__/grading-semantic.fixture.ts`

---

## Key Design Decisions

### 1. Strict `correct` Mapping
```typescript
// ✅ Safe - correct === truly perfect, not "mostly"
correct: score >= 0.90  // Only "Correct" band maps to true
```
This preserves backward compatibility - existing code that filters on `correct` still works.

### 2. Jaccard Gate Doesn't Claim Perfect
```typescript
// Gate 2: High similarity → 0.85, shows as "Mostly Correct"
if (jaccard(user, ref) >= 0.6) {
  score: 0.85,           // Not 1.0 - don't overclaim
  correct: false,        // Not auto-claiming perfect
  feedback: "Mostly correct (high similarity to reference)."
}
```

### 3. Score Clamping Everywhere
```typescript
function clampScore(s: number): number {
  return Math.round(Math.max(0, Math.min(1, s)) * 100) / 100;
}
```
Prevents weird AI edge cases (1.2, -0.1) from breaking UI.

### 4. AI Parse Errors Are Retryable
```typescript
if (!parsed?.results || !Array.isArray(parsed.results)) {
  throw new Error('AI_GRADING_PARSE_ERROR: Missing results array');
}
```
Don't silently mark incorrect - throw retryable error so client can retry.

---

## Testing

### TypeScript Check
```bash
cd web && npx tsc --noEmit
```
- 35 pre-existing errors (none new)

### Build
```bash
cd web && npm run build
```
- ✅ 635.65 kB (gzip: 177.88 kB)

### Regression Test
```bash
npx tsx web/api/_lib/__tests__/grading-semantic.fixture.ts
```
- ✅ 4/4 tests passing

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| StatusBadge bands | Low | Pure UI, backward compat via fallback |
| AI semantic grading | Medium | Hybrid gate + `correct` = score >= 0.90 |
| New BreakdownItem.score | Low | Optional field, existing code ignores |

---

## References

- Plan: `C:\Users\ÄGARE\.claude\plans\toasty-hatching-squirrel.md`
- Related: P2-B "World-Class UI" (score bands are prerequisite)
