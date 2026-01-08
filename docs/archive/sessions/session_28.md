# Session 28: Persistent Quiz Summary Card

**Date**: 2025-12-08
**Branch**: main
**Status**: ✅ Complete

## Overview

Added a persistent summary card to quiz results page that displays score, letter grade, and contextual feedback prominently at the top. Previously, users only saw a transient toast notification after grading; now the same information is permanently visible on the AttemptDetail page.

## Problem Statement

**Current Behavior**: When a quiz is graded, users see:
- Toast message: `"Scored 85% (B)"` (disappears after a few seconds)
- Score badge in header: `"Score: 85%"`
- No prominent summary with grade + feedback

**User Impact**:
- Easy to miss the grade if toast is dismissed
- No overall feedback/encouragement visible on results page
- Users have to infer their performance from per-question details

## Solution

Added a persistent **Quiz Summary Card** at the top of submitted quiz attempts:
- Large percentage display (e.g., "85%")
- Correct count (e.g., "7 out of 10 correct")
- Letter grade (e.g., "Grade: B")
- Contextual feedback message aligned with FollowUpFeedback tone
- Status badge ("Great job" / "Keep going" / "Needs review")

## Implementation Details

### Files Modified

**`web/src/pages/AttemptDetail.tsx`** (~75 lines added)

### Changes Made

#### 1. Imports
```typescript
// Added useMemo for performance optimization
import { useEffect, useState, useRef, useMemo } from "react";

// Reused shared type instead of redefining
import type { BreakdownItem } from "@/lib/grader";
```

#### 2. Helper Functions (Lines 63-87)
```typescript
// TODO: centralize grade logic in shared util to prevent client/server drift

function calculateLetterGrade(percent: number): string {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
}

function generateSummaryMessage(percent: number): string {
  if (percent >= 90) return "Excellent mastery of this material — you're basically exam-ready.";
  if (percent >= 70) return "Good understanding with a few weak spots — focus on the questions below.";
  if (percent >= 50) return "Decent start, but you'll benefit from another pass using the tips below.";
  return "This topic needs more review — use the weak questions section as your study guide.";
}

function getStatusBadgeText(percent: number): string {
  if (percent >= 90) return "Great job";
  if (percent >= 70) return "Keep going";
  return "Needs review";
}
```

**Design Decisions**:
- Letter grade thresholds match backend exactly (`grade.ts:248-258`)
- Summary messages reference "questions below" and "tips below" to connect with FollowUpFeedback section
- TODO comment added for future centralization into shared utility

#### 3. Memoized Derived Values (Lines 89-94)
```typescript
// Normalize percent ONCE to ensure display + letter grade + summary are always in sync
const percent = useMemo(() => {
  if (attempt?.score == null) return null;
  return Math.round(attempt.score * 100);
}, [attempt?.score]);

// Calculate correct count from grading array (typed properly)
const correctCount = useMemo(() => {
  if (!attempt?.grading || !Array.isArray(attempt.grading)) return 0;
  return (attempt.grading as BreakdownItem[]).filter(item => item.correct).length;
}, [attempt?.grading]);

// Total questions (memoized for consistency)
const totalQuestions = useMemo(() => {
  return attempt?.grading?.length ?? 0;
}, [attempt?.grading]);
```

**Why Memoized**:
- `percent` - Prevents recalculation on every render, ensures consistency across display/grade/summary
- `correctCount` - Avoids re-filtering grading array on every render
- `totalQuestions` - Symmetry with other memoized values

**Edge Case Handling**:
- `score=0.795` → `Math.round(0.795 * 100) = 80` → displays "80%" with grade "B" (not "79.5%" with "C")

#### 4. Summary Card JSX (Lines 459-495)
```tsx
{/* Summary Card (Session 28) */}
{isSubmitted && percent !== null && (
  <section
    className="surface bdr radius p-6 mb-6"
    aria-labelledby="quiz-summary-heading"
  >
    <div className="flex items-center mb-2">
      <h2 id="quiz-summary-heading" className="text-lg font-semibold">
        Quiz Summary
      </h2>
      <span className="badge badge-soft ml-2">
        {getStatusBadgeText(percent)}
      </span>
    </div>

    {/* Score and percentage */}
    <div className="mb-2">
      <span className="text-2xl font-bold">
        {percent}%
      </span>
      <span className="text-muted ml-2">
        ({correctCount} out of {totalQuestions} correct)
      </span>
    </div>

    {/* Letter grade */}
    <div className="mb-3">
      <span className="font-semibold">Grade: </span>
      <span className="text-xl font-bold">{calculateLetterGrade(percent)}</span>
    </div>

    {/* Overall feedback */}
    <div className="text-muted">
      {generateSummaryMessage(percent)}
    </div>
  </section>
)}
```

**Visual Placement**:
```
[Page Header] ← Title, class, score badge (existing)
[Summary Card] ← NEW: Score, grade, feedback (Session 28)
[Questions] ← Per-question review (existing)
[FollowUpFeedback] ← Weak questions + retake buttons (Session 27)
[Footer] ← Navigation (existing)
```

**Accessibility**:
- Semantic `<section>` with `aria-labelledby`
- Proper heading hierarchy (`<h2>`)
- Text contrast verified with existing design tokens

## Data Flow

### Fields Used

**From `quiz_attempts` table**:
- `attempt.score` - 0..1 decimal (e.g., 0.85 = 85%)
- `attempt.grading` - Array of `BreakdownItem` objects

**Calculated client-side**:
- Letter grade (A-F) - Matches backend thresholds
- Summary message - Aligned with FollowUpFeedback tone
- Correct count - Filtered from grading array
- Total questions - Array length

### Why Client-Side Calculation?

The backend `grade.ts` returns `letter` and `summary` in the API response, but these are **not persisted** to the database. The frontend currently only uses them in the toast message.

By replicating the same calculation logic client-side, we can display persistent results without any backend changes or schema modifications.

## Type Safety

**Before**: Local `BreakdownItem` interface definition (duplicated from FollowUpFeedback)

**After**: Imported shared type
```typescript
import type { BreakdownItem } from "@/lib/grader";
```

**Benefits**:
- Consistency with `FollowUpFeedback.tsx` and `grader.ts`
- Single source of truth for type definition
- Automatic updates if type changes in future

## Improvements Made (User Feedback)

1. **✅ Percent normalization** - Single `Math.round()` prevents display/grade mismatch
2. **✅ Type reuse** - Import `BreakdownItem` from `@/lib/grader` instead of redefining
3. **✅ Performance** - Memoized all derived values (`percent`, `correctCount`, `totalQuestions`)
4. **✅ Tone alignment** - Messages reference "questions below" and "tips below"
5. **✅ Accessibility** - Semantic HTML with ARIA labels
6. **✅ Visual polish** - Status badge for quick visual feedback
7. **✅ Future-proofing** - TODO comment to centralize grade logic

## Testing Checklist

- [ ] Submit a quiz and verify summary card appears with correct score/grade
- [ ] **Edge case**: score=0.795 shows "80%" AND "B" grade (not 79.5% and "C")
- [ ] Verify summary messages match score ranges:
  - 90%+: "Excellent mastery..."
  - 70-89%: "Good understanding..."
  - 50-69%: "Decent start..."
  - <50%: "This topic needs more review..."
- [ ] Verify correct/total count is accurate
- [ ] Verify status badge shows appropriate text based on score
- [ ] Verify semantic HTML (section with aria-labelledby)
- [ ] Verify spacing on mobile (no cramped layout with FollowUpFeedback)
- [ ] Verify existing FollowUpFeedback component still works (Session 27)
- [ ] Verify retake flow still works (Session 27)
- [ ] Verify toast still appears in QuizPage after grading
- [ ] Verify memoization prevents unnecessary re-renders (React DevTools)

## Guardrails Verified

✅ **No backend changes** - Uses existing `score` and `grading` fields only
✅ **No schema changes** - No new database columns needed
✅ **No API changes** - No new endpoints or modified contracts
✅ **Frontend-only** - All changes in React components
✅ **Preserves Session 27 work** - FollowUpFeedback and retake flow unchanged
✅ **Keeps existing toast** - QuizPage.tsx toast remains for immediate feedback
✅ **TypeScript safe** - 0 new errors introduced (build verified)

## Build Status

✅ **TypeScript Check**: All errors are pre-existing (telemetry event types from previous sessions)
✅ **Zero new errors** introduced by this change
✅ **Import structure** verified (useMemo, BreakdownItem type)

## Code Quality

- **Lines Added**: ~75 (single file)
  - 1 import addition (useMemo)
  - 1 type import (BreakdownItem)
  - 3 helper functions (~25 lines)
  - 3 memoized values (~6 lines)
  - 1 summary card JSX (~37 lines)
  - 1 TODO comment
- **TypeScript Errors**: 0 new errors
- **Performance**: Optimized with useMemo
- **Maintainability**: TODO comment for future centralization

## User Experience Impact

**Before**:
- Toast shows score briefly (easy to miss)
- Header shows score badge
- No prominent grade or feedback

**After**:
- **Persistent summary card** at top of results
- Large, scannable score display (85%)
- Letter grade prominently shown (Grade: B)
- Contextual encouragement message
- Visual status badge
- All information stays visible (no disappearing toast)

**Expected Outcome**: Users have clear, persistent visibility of their performance with actionable feedback.

## Future Enhancements (Not Implemented)

**Possible Improvements**:
- Centralize `calculateLetterGrade` and `generateSummaryMessage` into `@/lib/gradeUtils`
  - Share between frontend and backend
  - Prevent client/server drift
  - Single source of truth for grade thresholds
- Add grade trend indicator (improved/declined from previous attempts)
- Add "View All Attempts" link in summary card
- Animate score reveal on first load
- Add export/share button for results

## Notes

- Summary messages intentionally reference FollowUpFeedback ("questions below", "tips below") to create narrative flow
- Status badge uses existing design tokens (`badge badge-soft`)
- Grade thresholds are duplicated from backend for now (TODO to centralize)
- This complements (not replaces) the existing toast notification
- Works seamlessly with Session 27's retake flow

## Related Sessions

- **Session 27**: True retake quiz feature (FollowUpFeedback component)
- **Session 25**: ChatGPA v1.12 UX Pivot (FollowUpFeedback implementation)
- **Session 24**: Quiz page refactor (one-question-at-a-time UI)

---

**Session Status**: ✅ Complete
**Ready for**: User testing, visual QA on mobile
**Next Steps**: Monitor user feedback on summary card visibility and tone
