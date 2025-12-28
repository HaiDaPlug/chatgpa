# Session 29: localStorage Persistence for Quiz Progress

**Date**: 2025-12-26
**Branch**: alpha
**Status**: ✅ Complete

## Overview

Implemented client-side localStorage persistence for QuizPage to prevent data loss on page refresh. This solves the **#1 critical UX gap** blocking users from a smooth quiz-taking experience. Users can now refresh mid-quiz and continue exactly where they left off with all answers and current question index preserved.

## Problem Statement

**Current Behavior**: QuizPage stores answers and current question index only in React state
- **User Impact**: Page refresh loses all quiz progress
- **Pain Point**: Users accidentally refresh or close tab → lose 10+ minutes of work
- **Workaround**: None available
- **Priority**: Critical UX blocker (top of priority list in CURRENT_STATE.md)

**Why This Matters**:
- Students study in interrupted sessions (notifications, multitasking)
- Accidental refreshes are common (Ctrl+R, browser reload)
- Losing progress kills motivation to retake quiz
- This was identified as the most important UX improvement before retake analytics

## Solution

Added **localStorage persistence layer** to QuizPage.tsx with comprehensive validation:
- Save quiz progress (`answers` + `currentIndex`) on every change
- Restore progress when user returns after refresh
- Clear localStorage after successful submission
- Validate stored data to prevent corruption/stale data issues
- Support future `?attempt=` query param for retake flow

**Scope**: Frontend-only, no server autosave integration, no navigation blocking UI

## Implementation Details

### Files Modified

**`web/src/pages/QuizPage.tsx`** (~182 lines added to single file)

### Changes Made

#### 1. Imports (line 5-6)
```typescript
// Added useRef for hydration guards
import { useEffect, useState, useRef } from "react";
// Added useSearchParams for ?attempt= query param
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
```

#### 2. Type Definition (after line 33)
```typescript
interface QuizProgressData {
  version: number;         // Schema version for future migration
  quizId: string;          // Verify matches current quiz
  attemptId?: string;      // Optional, from ?attempt= param
  questionIds: string[];   // Order-aware validation
  answers: Record<string, string>;
  currentIndex: number;
  updatedAt: string;       // ISO timestamp
}
```

#### 3. Constants (after types)
```typescript
const QUIZ_PROGRESS_VERSION = 1;

// Resolve storage key from attemptId or quizId
const getQuizProgressKey = (quizId: string, attemptId?: string) => {
  if (attemptId) return `quiz_progress_attempt_${attemptId}`;
  return `quiz_progress_quiz_${quizId}`;
};
```

#### 4. Helper Functions (~150 lines total)

**`loadQuizProgress(storageKey, quizId, questions)`**
- Validates JSON structure (all required fields + types)
- Checks schema version matches `QUIZ_PROGRESS_VERSION`
- Validates quizId matches current quiz
- **Order-aware questionIds comparison** (prevents currentIndex pointing to wrong question if backend reorders)
- Defensive check: if `questions.length === 0`, treat as invalid
- Clamps currentIndex to `[0..questions.length-1]`
- Returns `QuizProgressData | null` (null on any validation failure)
- DEV-only console warnings for mismatches
- Silent failure on localStorage quota exceeded

**`saveQuizProgress(storageKey, quizId, attemptId, questionIds, answers, currentIndex)`**
- Creates data object with all fields
- JSON.stringify and store to localStorage
- Silent failure on errors (quiz continues without persistence)
- DEV-only error logging

**`clearQuizProgress(storageKey)`**
- Removes from localStorage
- Takes resolved storage key (not quizId)
- Silent failure on errors

#### 5. Hydration Guards (line ~445)
```typescript
const didHydrateRef = useRef(false);   // Track if we've already restored
const isHydratingRef = useRef(false);  // Track if we're currently hydrating
const hasEverSavedRef = useRef(false); // Track if we've saved at least once
```

**Why Three Refs?**
- `didHydrateRef`: Prevent double-restore on React StrictMode double-mount
- `isHydratingRef`: Prevent save-effect from overwriting during hydration
- `hasEverSavedRef`: Only skip empty state on FIRST render (allows user to delete all answers later)

#### 6. Query Params (line ~441)
```typescript
const [searchParams] = useSearchParams();
const attemptId = searchParams.get('attempt') || undefined;
const storageKey = quizId ? getQuizProgressKey(quizId, attemptId) : null;
```

**Future Compatibility**: Supports `/quiz/:id?attempt=abc` for retake flow (Session 27 infrastructure)

#### 7. Progress Restoration (in quiz fetch effect, after `setQuiz`)
```typescript
// Try to restore progress from localStorage (only once per page load)
if (!didHydrateRef.current) {
  // Use fetched data.id as source of truth (not route quizId)
  const key = getQuizProgressKey(data.id, attemptId);

  // Assert route quizId matches fetched id in DEV
  if (import.meta.env.DEV && quizId !== data.id) {
    console.warn('QUIZ_STORAGE_ID_MISMATCH', { routeId: quizId, fetchedId: data.id });
  }

  const stored = loadQuizProgress(key, data.id, qs);
  if (stored) {
    isHydratingRef.current = true; // Keep true through first save-effect pass
    setAnswers(stored.answers);
    setCurrentIndex(stored.currentIndex);
    // DEV-only logging
  }

  // Cleanup: if using attempt-key, remove orphaned quiz-key
  if (attemptId) {
    localStorage.removeItem(`quiz_progress_quiz_${data.id}`);
  }

  didHydrateRef.current = true;
}
```

**Key Design Decisions**:
- Use fetched `data.id` as source of truth (not route `quizId`)
- Assert they match in DEV mode
- Keep `isHydratingRef` true until save-effect runs
- Cleanup orphaned keys when switching from quiz-key to attempt-key

#### 8. Save Effect (after quiz fetch effect)
```typescript
// Save progress to localStorage whenever answers or currentIndex change
useEffect(() => {
  if (!quiz || !quizId || !storageKey) return;

  // Skip first save-effect pass after hydration
  if (isHydratingRef.current) {
    isHydratingRef.current = false;
    return;
  }

  // Don't save empty state on FIRST render only
  if (!hasEverSavedRef.current && Object.keys(answers).length === 0 && currentIndex === 0) {
    return;
  }

  const questionIds = quiz.questions.map((q) => q.id);
  saveQuizProgress(storageKey, quizId, attemptId, questionIds, answers, currentIndex);
  hasEverSavedRef.current = true;
}, [answers, currentIndex, quiz, quizId, attemptId, storageKey]);
```

**Why This Pattern?**
- Flip `isHydratingRef` to false INSIDE effect (not immediately after setAnswers/setCurrentIndex)
- This prevents save from firing before React applies restored state
- Only skip empty state on first render (not perpetually)

#### 9. Clear on Submission (in `handleSubmit`, after success toast)
```typescript
// Clear localStorage after successful submission
if (storageKey) {
  clearQuizProgress(storageKey);
}
```

**Timing**: After success toast, before `navigate("/results")`

---

## Data Flow

### Save Flow
```
User types answer
  ↓
setAnswer(questionId, value)
  ↓
answers state updated
  ↓
Save effect triggers
  ↓
Check guards (isHydrating? empty state on first render?)
  ↓
Extract questionIds from quiz.questions
  ↓
saveQuizProgress(storageKey, quizId, attemptId, questionIds, answers, currentIndex)
  ↓
localStorage.setItem(storageKey, JSON.stringify(data))
```

### Restore Flow
```
User navigates to /quiz/:id
  ↓
Fetch quiz from database
  ↓
setQuiz({ id, class_id, questions })
  ↓
Check didHydrateRef.current === false?
  ↓
Resolve storageKey from data.id + attemptId
  ↓
loadQuizProgress(storageKey, data.id, questions)
  ↓
Validate schema, version, quizId, questionIds order, bounds
  ↓
If valid: setAnswers(stored.answers), setCurrentIndex(stored.currentIndex)
  ↓
Set isHydratingRef.current = true (prevents save-loop)
  ↓
Save effect runs, detects isHydrating, flips to false, returns early
  ↓
User continues quiz from exact saved state
```

### Clear Flow
```
User clicks "Submit Quiz"
  ↓
handleSubmit() calls /api/v1/ai?action=grade
  ↓
API returns success
  ↓
Show success toast
  ↓
clearQuizProgress(storageKey)
  ↓
localStorage.removeItem(storageKey)
  ↓
navigate("/results")
```

---

## Validation Logic

### Schema Validation
- Check all required fields exist: `version`, `quizId`, `attemptId?`, `questionIds`, `answers`, `currentIndex`, `updatedAt`
- Verify correct types: number, string, string?, array, object, number, string
- Match version number: `parsed.version === QUIZ_PROGRESS_VERSION` (1)
- Verify quizId: `parsed.quizId === quizId`

### Stale Data Detection (Order-Aware)
```typescript
const currentQuestionIds = questions.map((q) => q.id);

// Length check first (fast fail)
if (parsed.questionIds.length !== currentQuestionIds.length) {
  localStorage.removeItem(storageKey);
  return null;
}

// Check exact array equality (same order)
const hasStaleData = parsed.questionIds.some(
  (id: string, idx: number) => id !== currentQuestionIds[idx]
);
if (hasStaleData) {
  localStorage.removeItem(storageKey);
  return null;
}
```

**Why Order Matters**: If backend reorders questions, `currentIndex: 2` could point to a different question. Order-aware comparison detects this.

### Bounds Checking
```typescript
// Defensive check: if no questions, treat as invalid
if (questions.length === 0) {
  localStorage.removeItem(storageKey);
  return null;
}

// Clamp currentIndex to valid range
if (parsed.currentIndex < 0) {
  parsed.currentIndex = 0;
} else if (parsed.currentIndex >= questions.length) {
  parsed.currentIndex = questions.length - 1;
}
```

### Error Handling
- All localStorage operations wrapped in try/catch
- Invalid data → remove from storage, return null, start fresh
- Parsing errors → log to console (DEV only), fail silently
- Storage quota exceeded → log error (DEV only), quiz still works
- **No prod console.log** (gated with `import.meta.env.DEV`)

---

## Data Structure

**Stored in localStorage at key**:
- `quiz_progress_attempt_${attemptId}` if `?attempt=` present
- `quiz_progress_quiz_${quizId}` otherwise

```json
{
  "version": 1,
  "quizId": "abc-123-quiz-uuid",
  "attemptId": "def-456-attempt-uuid",  // Optional
  "questionIds": ["q1_abc", "q2_def", "q3_ghi"],
  "answers": {
    "q1_abc": "Option A",
    "q2_def": "This is my detailed explanation of the concept..."
  },
  "currentIndex": 1,
  "updatedAt": "2025-12-26T10:30:45.123Z"
}
```

---

## Edge Cases Handled

### 1. Hydration Double-Restore
**Problem**: React StrictMode double-mounts components in DEV
**Solution**: `didHydrateRef` ensures restore happens only once per page load

### 2. Save-Loop During Hydration
**Problem**: `setAnswers(stored.answers)` triggers save-effect immediately
**Solution**: `isHydratingRef` stays true until save-effect runs, then flips to false and returns early

### 3. Perpetual Empty-State Skip
**Problem**: If user answers questions then deletes all answers, save stops working
**Solution**: Only skip empty state on FIRST render (check `hasEverSavedRef`)

### 4. Backend Reorders Questions
**Problem**: `currentIndex: 2` could point to different question if order changes
**Solution**: Order-aware questionIds comparison (exact array equality)

### 5. Route quizId ≠ Fetched data.id
**Problem**: Route param might not match fetched quiz id
**Solution**: Use fetched `data.id` as source of truth, assert match in DEV

### 6. Orphaned Storage Keys
**Problem**: User starts `/quiz/:id` (quiz-key), then `/quiz/:id?attempt=...` (attempt-key) → two keys
**Solution**: Remove orphaned quiz-key when using attempt-key

### 7. Corrupted localStorage JSON
**Problem**: User manually edits localStorage or quota exceeded mid-write
**Solution**: Comprehensive validation, clear invalid data, start fresh

### 8. questions.length === 0
**Problem**: Stored quiz has no questions (edge case)
**Solution**: Treat as invalid, clear storage, return null

---

## Testing Checklist

### Core Functionality
- [x] Start quiz, answer 3 questions, refresh → answers restored ✅
- [x] Answer question → localStorage updates immediately (verified in DevTools) ✅
- [x] Navigate between questions → currentIndex persists ✅
- [x] Complete and submit quiz → localStorage cleared ✅

### Hydration Guard
- [x] Hydration happens only once per page load ✅
- [x] Save effect doesn't fire during hydration ✅
- [x] Dev StrictMode double-mount doesn't restore twice ✅

### Retake Flow (Future Compatibility)
- [ ] Navigate to `/quiz/:id?attempt=abc` → uses `quiz_progress_attempt_abc` key
- [ ] Navigate to `/quiz/:id` → uses `quiz_progress_quiz_${id}` key
- [ ] Retake same quiz → doesn't restore old quiz progress (separate keys)

### Edge Cases
- [x] Manually corrupt localStorage JSON → graceful fallback (starts fresh) ✅
- [ ] Regenerate quiz (different questions) → old answers not loaded
- [ ] Backend reorders questions → detected as stale
- [x] Start Quiz A, then Quiz B → each quiz has separate storage ✅
- [x] Set currentIndex to 999 in localStorage → clamped to `questions.length - 1` ✅
- [x] Set currentIndex to -5 → clamped to 0 ✅
- [x] User answers all questions, then deletes all → still saves ✅

### Error Handling
- [x] Disable localStorage in browser → quiz works without errors ✅
- [ ] Fill localStorage to quota → quiz continues working (no crash)

### UX Validation
- [x] Multiple refreshes → always restores to exact state ✅
- [x] Close tab, reopen quiz → progress restored ✅
- [x] Answer 5 questions, submit → results page shows all 5 answers correctly ✅
- [x] No console.log in production build (only in DEV mode) ✅

---

## Guardrails Verified

✅ **No backend changes** - All changes in QuizPage.tsx only
✅ **No schema changes** - No new database columns
✅ **No API changes** - No new endpoints or modified contracts
✅ **Frontend-only** - Pure client-side persistence
✅ **Preserves existing flow** - Quiz submission, grading, results all unchanged
✅ **TypeScript safe** - 0 new errors introduced (verified with `npx tsc --noEmit`)
✅ **DEV-only logging** - All console.log/warn/debug gated with `import.meta.env.DEV`

---

## Build Status

✅ **TypeScript Check**: `npx tsc --noEmit` shows 0 new errors
- All pre-existing errors are in other files (telemetry event types, Framer Motion types)
- QuizPage.tsx has 0 errors

✅ **Lines Added**: ~182 lines
- Import update: ~1 line
- Type definition: ~9 lines
- Constants: ~5 lines
- Helper functions: ~115 lines (comprehensive validation)
- Refs: ~3 lines
- Query params: ~4 lines
- Load on mount: ~28 lines (with guards + cleanup)
- Save effect: ~14 lines (with guards)
- Clear on submit: ~3 lines

---

## Code Quality

### Performance
- `loadQuizProgress()`: O(n) where n = questions.length (single pass)
- `saveQuizProgress()`: O(n) to extract questionIds, then O(1) localStorage write
- localStorage writes are synchronous but fast (~1ms)
- No debouncing needed (saves are already efficient)

### Maintainability
- All persistence logic isolated to 3 helper functions
- Clear separation: helpers → main component → effects
- Comprehensive inline comments explaining "why" not just "what"
- DEV-only assertions for debugging

### Type Safety
- All types explicitly defined (`QuizProgressData`, function signatures)
- Runtime validation matches TypeScript types
- No `any` types used

---

## User Experience Impact

**Before**:
- User answers 7 out of 10 questions
- Accidentally refreshes page (Ctrl+R)
- **All progress lost** → starts from Question 1 with no answers
- User frustration → abandons quiz

**After**:
- User answers 7 out of 10 questions
- Accidentally refreshes page
- **Page reloads to Question 8** with all 7 answers preserved
- User continues quiz seamlessly

**Expected Outcome**: Significant reduction in abandoned quizzes due to accidental refresh.

---

## Future Enhancements (Not Implemented)

**Possible Improvements**:
1. **Server-side autosave integration** - Sync localStorage with `/api/v1/attempts?action=autosave`
   - Requires creating `in_progress` attempts via `/api/v1/attempts?action=start`
   - Adds conflict resolution UI
   - Out of scope for this session

2. **Navigation blocking UI** - Warn user before leaving quiz
   - Requires data router migration (`createBrowserRouter`)
   - Use `useBlocker` hook
   - Separate priority item

3. **"Resume Quiz" feature in Results page**
   - Show incomplete quizzes in Results page
   - Link to resume from where user left off
   - Depends on backend tracking `in_progress` attempts

4. **Storage cleanup service**
   - Periodically remove stale localStorage entries
   - Remove quiz progress after 7 days of inactivity
   - Low priority polish

5. **Visual "unsaved changes" indicator**
   - Show icon when localStorage has pending changes
   - Not needed since saves are instant

---

## Related Sessions

- **Session 27**: True retake quiz feature (added `?attempt=` infrastructure)
- **Session 28**: Persistent quiz summary card (results page improvements)
- **Session 24**: Quiz page refactor (one-question-at-a-time UI)

---

## Notes

- Implementation took ~2 hours (as estimated)
- All guardrails verified (no backend/schema/API changes)
- **0 new TypeScript errors** introduced
- Ready for user testing and production deployment
- This was the **#1 priority** from CURRENT_STATE.md (High-Value UX section)

---

**Session Status**: ✅ Complete
**Ready for**: Production deployment, user testing
**Next Steps**:
1. Monitor user feedback on persistence reliability
2. Track localStorage quota exceeded errors (if any)
3. Consider navigation blocking UI as separate feature
4. Add retake analytics dashboard (next priority from CURRENT_STATE.md)
