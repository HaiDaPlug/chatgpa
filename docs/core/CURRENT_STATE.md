# ChatGPA  Current State

**Last Updated**: January 3, 2026 (Session 39 - API Error Resilience Complete)
**Branch**: `alpha`
**Build Status**: ✅ Passing (0 TypeScript errors, 619.02 kB build)

---

## 🎯 Immediate Priorities

### North Star
Ship a world-class quiz generator where the core loop feels premium + reliable:
**Generate → Take quiz (one-question UI) → Submit → World-class Results/Review → Practice mistakes → Repeat**
Zero progress loss. Zero trust leaks.

### ✅ P0-A — Quiz Experience Stability (COMPLETE)
**Problem:** Loading screen visibly flashed/reset multiple times after quiz content appeared.
**Root Causes:**
- Session 37: AnimatePresence mode="wait" + location.search forced unmount/remount
- Session 38: Render condition allowed showing loader after content visible
**Fixes:**
- Session 37: Removed mode="wait" and location.search from key → stable mounts
- Session 38: UI-ready latch prevents loader from reappearing → one-way state transition
**Status:** ✅ Shipped (Sessions 37 + 38)
**Impact:** Loading screen appears once and stays stable, premium perception restored.

### ✅ P0-A2 — API Error Resilience (COMPLETE)
**Problem:** Quiz generation occasionally failed with "Non-JSON response from model" error, zero diagnostic context.
**Root Cause:** Router returned `?? "{}"` on empty response, no logging of finish_reason/tokens, no recovery for common patterns.
**Fixes (Session 39):**
- Removed `"{}"` fallback → preserves truth, logs raw content preview
- Added JSON repair (markdown fences, leading prose, objects + arrays)
- Single retry on transient errors (new request_id, feature-flagged)
- Comprehensive logging: finish_reason, usage, pattern, truncation detection
- Status 502 (upstream failure) instead of 400 (user fault)
**Status:** ✅ Shipped (Session 39)
**Impact:** Automatic recovery from transient failures, full diagnostic visibility, user-friendly error messages.

### P0-B — World-Class Loading States + Generation Perceived Speed
**Problem:** Generation feels "forever" and waiting lacks trust-building feedback.
**Why it matters:** Even if backend is correct, users interpret silence as broken.
**How we'll fix (frontend-only first):**
- Add honest staged loading UI (no fake progress), plus Cancel (AbortController) + manual Retry
- Add client-side latency breakdown timers (click → request → response → parse/validate → UI ready)
- Prevent duplicate generate requests (disable/guard re-entry)

### P1 — Grading Quality (Core Moat) 🚨 CRITICAL BEFORE USERS
**Problem:** Grading is overly strict; freeform answers are marked incorrect even when notes are copied/pasted.
**Why it matters:** Grading accuracy is **THE moat**. If grading feels dumb, product becomes "Quizlet-like" and loses trust. This must be fixed before any user testing.
**How we'll fix (mostly prompt + rubric, minimal code):**
- Update grading rubric to accept paraphrases/semantic equivalence and award partial credit when appropriate
- Require grader to cite which concept is missing (short), and give one improvement step
- Keep tone as "calm coach" (helpful, precise, not intense)
- Confirm schema/UX surfaces partial vs incorrect consistently

### P2 — Generator Quality (Nuance + Variety + Cases)
**Problem:** Questions feel repetitive (same templates, same examples, surface-level recall).
**Why it matters:** Nuanced/varied questions are *real value*, not a cheap gimmick. Different examples reduce memorization and force understanding (good learning science). Case/scenario diagnosis is a killer differentiator *if* graded well.
**Why after P1:** Adding case questions before grading accepts reasoning/paraphrase will leak trust faster.
**How we'll build (small + safe, after P1 is fixed):**
- **Controlled variation**: Keep concept same, vary surface (new examples not in notes, different contexts)
- **Perspective rotation templates**: Mix recall (small %), explanation/why, compare & contrast, common misconception, application, and case/diagnosis (1-2 per quiz)
- **Deterministic variety**: Seed based on `(notesHash + userId + day)` for freshness without lottery feel
- **Diversity constraints**: "Don't reuse same example twice in a quiz" and "avoid same template twice in a row"
- **Case/scenario questions**: Short scenario grounded in notes → student diagnoses/chooses next step → graded on reasoning, not exact phrasing
- **Prompt additions**: "Use new examples not in notes but keep realistic", "Generate N different contexts", "Include 1 scenario-based diagnostic if notes describe processes/systems"

### P3 — Clarity Polish
Modernize Dashboard + Generate page + "pre-results" navigation for clarity:
clear next actions, saved-state reassurance, fewer ambiguous states (no major visual redesign).

### P4 — Landing Page Sharpening
Polish positioning + structure after the product loop feels premium and stable (later).

---

##  What's Working (Production-Ready)

### Core Study Loop
- ✅ **Upload Notes** - ClassNotes page, real data storage
- ✅ **Configure Quiz** - Section 4 quiz config system with LocalStorage
- ✅ **Generate Quiz** - `/api/v1/ai?action=generate_quiz` with AI Router
- ✅ **Take Quiz** - One-question-at-a-time UI with progress bar (Session 24)
- ✅ **Submit & Grade** - `/api/v1/ai?action=grade` with rubric engine
- ✅ **View Results** - Results page with error visibility fixed
- ✅ **Telemetry** - `/api/v1/util?action=track` analytics events

### Sections Complete (1-7)
- ✅ **Section 1**: AI Router with automatic fallback (gpt-4o-mini → gpt-5-mini)
- ✅ **Section 2**: Length-agnostic rubric grading system
- ✅ **Section 3**: Results page with autosave + conflict resolution
- ✅ **Section 4**: Quiz configuration system (question types, difficulty, coverage)
- ✅ **Section 5**: Folder workspace with 10 API endpoints (all 9 phases)
- ✅ **Section 6a**: Sidebar navigation with breadcrumbs & accessibility
- ✅ **Section 6b**: API Gateway consolidation (`/api/v1/*` structure)
- ✅ **Section 7**: Theme System V2 with 3 presets (academic-dark, midnight-focus, academic-light)

### Latest Updates (Sessions 28-39)
- ✅ **Session 39: API Error Resilience (P0-A2)** - Bulletproof error handling
  - Removed dangerous `?? "{}"` fallback (preserves truth)
  - Added JSON repair: markdown fences, leading prose ("Sure! Here's..."), objects + arrays
  - Single retry on MODEL_EMPTY_RESPONSE / MODEL_NON_JSON (feature-flagged)
  - Comprehensive logging: finish_reason, usage, max_tokens, pattern, truncation_likely
  - Status 502 (upstream failure) instead of 400 (user input fault)
  - New request_id for retry (preserves parent_request_id for tracing)
  - ~244 lines added to ai-router.ts + generate.ts
  - 0 TypeScript errors, bundle: 619.02 kB (gzip: 173.66 kB)

- ✅ **Session 38: Fix Loading Screen Reset with UI-Ready Latch (P0-A)** - Final piece
  - After Session 37, still had 4 identical renders with visible loading screen resets
  - Root cause: Multiple async setState calls in quiz fetch effect not batched
  - Render condition allowed showing full-page loader after content visible
  - Solution: UI-ready latch (uiReady state) - one-way transition prevents snapback
  - 3 lines added to QuizPage.tsx, 1 condition changed
  - Loading screen appears once and stays stable
  - Surgical fix, zero impact on autosave/resume/hydration
  - API error discovered: "Non-JSON response from model" (investigation plan created)

- ✅ **Session 37: Fix Quiz UI Loading State Reset (P0-A)** - Eliminated unmount bug
  - Root cause: AnimatePresence mode="wait" + location.search in animation key
  - Fixed PageShell to prevent remounts on query param changes
  - Removed mode="wait" to stop forced unmount/remount cycles
  - Production logs proved real unmounts (not re-renders or StrictMode)
  - Added production-safe debug logging (?debugQuiz=1 or localStorage)
  - 2 lines changed in PageShell.tsx, ~30 lines diagnostic logs in QuizPage.tsx

- ✅ **Session 36: Fix Quiz Attempt Load Loop Bug** - Infinite loop prevention with UUID validation
  - Created centralized UUID validation utility (`web/src/lib/uuid.ts`)
  - Fixed 100+ errors/sec browser freeze from invalid `?attempt=undefined` URL params
  - Sanitized URL params at intake: `sanitizeUuidParam()` handles whitespace, "Undefined", "NULL"
  - Belt-and-suspenders validation before all Supabase queries with `.eq('id', ...)`
  - One-shot redirect guard prevents double navigation in React StrictMode
  - Selective error handling: only redirect on UUID errors (22P02), not transient network failures
  - Defense in depth: 4 files updated (QuizPage, AttemptDetail, ResultsNew, new uuid.ts)
  - Premium UX: clear error messages + safe navigation, no mystery loading states
  - ~105 lines of code (1 new file + 3 modified files)
  - Future-proof: prevents entire class of invalid UUID bugs from URL params, API responses, etc.

- ✅ **Session 35: Fix Gateway Response Wrapper Bug** - Quiz creation error spam fix
  - Fixed attempt_id extraction from gateway wrapper (`json.data` vs `json`)
  - Added UUID validation guard to prevent `?attempt=undefined` URLs
  - Eliminated 100+ errors/sec console spam when generating quizzes
  - User-safe error handling (clear message + redirect, no mystery spinner)
  - Defense in depth: root cause fix + validation guard
  - 2 locations fixed (attempt creation + autosave)
  - 14 lines changed, 0 new TypeScript errors
  - Future-proof against routing bugs and API response format changes

- ✅ **Session 34: Fix OpenAI API Parameter Error** - Reasoning model compatibility
  - Fixed `max_tokens` → `max_completion_tokens` for reasoning models (gpt-5*, o1, o3)
  - Created shared `buildOpenAIParams()` helper in ai-router.ts (regression-proof)
  - Updated both generation and grading paths to use helper
  - Added deprecation warnings to 3 legacy files
  - 0 new TypeScript errors, all grep checks passed
  - Eliminates "400 Unsupported parameter" error with reasoning models
  - Single source of truth prevents future "fixed in one place, forgot another" bugs

- ✅ **Session 33: Bulletproofing - Ship-Ready Polish** - Production hardening
  - P0: Direct navigation to `/attempts/:id` after submit (immediate feedback)
  - P0: Killed 2 rgba() token violations (100% token-first design)
  - P1: Practice Incorrect loop (retention mechanism with client-side filtering)
  - P1: Shuffle toggle (stable per-attempt randomization)
  - P2: Graceful error handling (null checks + calm fallback UI)
  - P2: Timestamp transparency ("Submitted X ago", "Last saved X ago")
  - P3: Generation reliability warnings (word count validation, non-blocking)
  - 4 commits, 486 lines across 4 files
  - All GUARD patterns followed (prevented Session 31 autosave regression)
  - 0 new TypeScript errors, Vite build: 616.42 kB (gzip: 172.92 kB)

- ✅ **Session 32: Modernize Results Page UI** - World-class results viewing experience
  - Built AttemptReview.tsx as single-file component (706 lines, all inline)
  - Hero scorecard with large letter grade + decorative underline
  - Insights strip: MCQ accuracy, typing accuracy, pattern detection
  - Filter toolbar: All/Incorrect pills with counts
  - Question cards: Expandable feedback with Framer Motion animations
  - Token-first design (no hardcoded colors, supports all themes)
  - Pre-verified data structure (BreakdownItem.type + attempt.started_at exist)
  - Integrated into AttemptDetail.tsx for submitted attempts
  - Preserved in-progress flow (no breaking changes)
  - 0 new TypeScript errors, Vite build successful (609.67 kB)

- ✅ **Session 31: Fix Resume Quiz + Server-Side Autosave** - Core loop completion
  - Fixed "Resume" to use modern QuizPage UI (not legacy AttemptDetail)
  - Added server-side autosave with world-class conflict resolution
  - Cross-device/browser resume now works (server baseline + localStorage overlay)
  - 800ms debounced autosave prevents API spam
  - All 5 critical fixes applied (deterministic merge, falsy handling, resolved IDs, browser-safe typing, change detection)
  - Modified 3 files: ResultsNew.tsx, AttemptDetail.tsx, QuizPage.tsx
  - 0 new TypeScript errors, ~150 lines added total
  - Uses existing APIs (start, autosave, grade) - no backend changes
  - Ready for browser testing (8-point checklist in session doc)

- ✅ **Session 30: Fixed Sidebar Stretching Bug** - UI polish
  - Locked app shell to viewport (sidebar + header fixed, main scrolls)
  - 4 minimal className changes in PageShell.tsx
  - Used `h-screen` for universal browser compatibility
  - Matches modern app patterns (Linear, Notion, VSCode, Figma)

- ✅ **Session 29: localStorage Persistence for Quiz Progress** - Solves #1 UX gap
  - Prevents data loss on page refresh (answers + currentIndex preserved)
  - Order-aware questionIds validation (detects if backend reorders questions)
  - Hydration guards prevent double-restore and save-loop on React StrictMode
  - Support for future `?attempt=` query param (retake flow compatibility)
  - Comprehensive validation: schema, version, bounds checking, stale data detection
  - DEV-only logging (no prod console.log)
  - Frontend-only changes, 0 new TypeScript errors
  - ~182 lines added to QuizPage.tsx

- ✅ **Session 28: Persistent Quiz Summary Card** - Enhanced results visibility
  - Added persistent summary card to AttemptDetail page (replaces toast-only)
  - Shows score (85%), correct count (7 out of 10), letter grade (B), and feedback
  - Client-side grade calculation with memoization for performance
  - Imported shared BreakdownItem type from @/lib/grader
  - Semantic HTML with aria-labelledby for accessibility
  - Status badge ("Great job" / "Keep going" / "Needs review")
  - Frontend-only changes, 0 new TypeScript errors

- ✅ **Session 27: True Retake Quiz** - Mastery loop implementation
  - "Retake This Quiz" creates new attempt on same quiz (same questions)
  - Fixed QuizPage to prevent dangling in_progress attempts
  - Fixed schema mismatch (both flows now use `responses: Record<string, string>`)
  - 3-button action hierarchy: Retake / Generate New / Start Fresh
  - Comprehensive telemetry and error handling

- ✅ **Session 26: Dev Override** - Improved local testing
  - `APP_MODE=test` raises quiz limit to 100 (from 5)
  - Dynamic error messages reflect actual limit
  - Backend logs dev override activation

- ✅ **Session 25: UX Pivot Phase 1** - ChatGPA v1.12 mission
  - FollowUpFeedback component with improvement tips
  - "Generate New Quiz" flow (same notes, different questions)
  - Clear UX labels distinguishing retake vs regenerate
  - README restructured around "world-class quiz generator" focus

### Previous Updates (Sessions 20-24)
- ✅ **Session 24: Quiz Page Refactor** - One-question-at-a-time pagination UI
- ✅ **Sessions 20-23** - Landing page, full authentication, navigation system, Theme System V2

### Infrastructure
- ✅ **Database**: 11 tables with RLS policies enforced
- ✅ **API Endpoints**: 23 across 6 gateways (`/api/v1/{ai,attempts,billing,marketing,util,workspace}`)
- ✅ **ESM Compliance**: All imports use `.js` extensions, NodeNext module resolution
- ✅ **Security**: Parent-ownership RLS verified, no service role abuse
- ✅ **Feature Flags**: 4 active flags for gradual rollout
- ✅ **Build Status**: 0 TypeScript errors in active code

### Usage Limits
- **Free Tier**: 5 quizzes maximum (enforced in `generate.ts`)
- **Dev Override**: When `APP_MODE=test`, limit is raised to 100 quizzes for local testing
- **Backend**: Dynamic error messages reflect current limit (`${FREE_QUIZ_LIMIT}`)
- **Frontend**: Error handling uses backend message (not hard-coded)

---

## 📋 Long-Term Roadmap (Post-Testing)

**See detailed analysis**: [MASTER_PRIORITIES.md](../../priorities/MASTER_PRIORITIES.md) | [STRATEGIC_ASSESSMENT.md](../../priorities/STRATEGIC_ASSESSMENT.md)

**Note**: Immediate priorities (P0, P0b, P1, P2, P3) listed above take precedence over all items below.

### Phase 0: Production Beta (🔴 Critical - 6 Blockers)
**Goal**: Public link, free users, stable core loop

1. **Rate Limiting** - Protect AI endpoints from abuse, cost control
2. **Observability** - Sentry error tracking, structured logging
3. **Usage Limits UX** - Verify free tier enforcement + upgrade path
4. **Attempts Integrity** - Idempotency on submit, retry logic
5. **Security Audit** - RLS verification, payload caps, input sanitization
6. **API Bulletproofing** - Consistent error messages, timeout testing

**Success criteria**: Ship without fear of abuse/crashes

---

### Phase 1: Production Launch (🚀 Must Have - 4 Blockers)
**Goal**: Paying users, full monetization (after Phase 0)

7. **Stripe End-to-End** - Subscribe/upgrade/cancel flows, webhooks
8. **Legal Basics** - Privacy policy, terms of service, GDPR compliance
9. **Onboarding Clarity** - First quiz success <2min, empty state guidance
10. **Recovery Flows** - Reset, resend email, contact support

**Success criteria**: Production-ready, monetizable

---

### Phase 2: Competitive Edge (💎 Should Have - 6 Priorities)
**Goal**: World-class differentiation (after market validation)

11. **Retake Analytics Dashboard** - Monitor mastery loop adoption, score improvements
12. **Question Quality Consistency** - Auto QA pass, flag ambiguous questions
13. **Question Diversity** - Bloom's taxonomy, difficulty distribution
14. **Practice Modes** - Weak topics, "same concept new question", spaced repetition
15. **Progress History** - Streak tracking, "continue studying" CTA
16. **Score Comparison Charts** - Visual motivation for retakes

**Success criteria**: Premium product users love and retain

---

### Phase 3: Scale & Polish (🌟 Nice to Have - 7 Priorities)
**Goal**: Long-term growth infrastructure

17. Navigation Blocking, 18. Design System Overhaul, 19. Rich Text Editor, 20. Real-Time Updates, 21. E2E Testing, 22. Bundle Optimization, 23. Pagination

---

### Recently Completed (Context)
- ✅ **localStorage Persistence** (Session 29) - Order-aware validation, hydration guards
- ✅ **Server-Side Autosave + Resume** (Session 31) - Conflict resolution, cross-device
- ✅ **Practice Incorrect** (Session 33 P1) - Retention mechanism
- ✅ **Shuffle Toggle** (Session 33 P1) - Stable per-attempt randomization
- ✅ **Input Quality Checks (P1)** (Session 33 P3) - Word count validation

---

### Critical Success Factors (Market Validation)
**The #1 question**: Do 10 users who try this for 2 weeks **love it** and **come back daily**?

**What must click** (see STRATEGIC_ASSESSMENT.md):
1. ✅ **Retention >35%** (Week 1→2: >50%, Month 1→2: >35%)
2. ✅ **Question quality as moat** (<5% unfair reports, NPS >50)
3. ✅ **One vertical dominance** (medical, law, AP exams - pick one)
4. ✅ **Viral loop works** (K-factor >0.3, quiz sharing)
5. ✅ **Monetization clicks** (5-10% conversion @ $15-20/mo)
6. ✅ **B2B channel opens** (tutoring centers, test prep companies)

**Next milestone**: Ship Phase 0 → Get 100 users → Measure retention → Decide strategy

---

## System Stats

### API Endpoints
- **Total**: 23 endpoints across 6 gateways
- **AI**: 3 (generate_quiz, grade, ai_health)
- **Attempts**: 4 (start, autosave, complete, update_meta)
- **Billing**: 2 (create_checkout, portal)
- **Marketing**: 2 (join_waitlist, feedback)
- **Util**: 4 (ping, health, track, use_tokens)
- **Workspace**: 9 (folder CRUD, note mappings, uncategorized)

### Database Tables
- **Core**: classes, notes, quizzes, quiz_attempts
- **Workspace**: folders, note_folders
- **System**: analytics, subscriptions, usage_limits, folder_health

### Frontend Pages
- `/` - Landing page (public)
- `/signin`, `/signup`, `/forgot-password`, `/reset-password` - Authentication
- `/dashboard` - Class list + recent attempts
- `/generate` - Quiz generation UI
- `/quiz/:id` - One-question-at-a-time quiz interface (Session 24)
- `/results/:attemptId` - Results + feedback
- `/attempts/:id` - Resume in-progress attempt
- `/classes/:classId/notes` - ClassNotes workspace with folders

### Feature Flags
```env
VITE_FEATURE_WORKSPACE_FOLDERS=false   # Folder workspace toggle
VITE_FEATURE_FOLDER_DND=false          # Drag-and-drop reordering
VITE_FEATURE_VISUALS=false             # Decorative frames/patterns
VITE_FEATURE_THEME_PICKER=false        # User theme selection UI
```

---

## 🐛 Known Issues & Limitations

### Minor Issues (Non-Blocking)
- **TypeScript Errors**: 12 errors in legacy/deprecated files (not in active code)
- **Pagination**: ClassNotes loads all notes at once (could paginate for 100+ notes)
- **Rate Limiting**: No rate limits on folder CRUD endpoints yet
- **Bundle Size**: No lazy loading or code splitting optimization

### Known Limitations
- ~~**Quiz Progress Persistence**~~: ✅ **FIXED (Session 29)** - Page refresh restores from localStorage
- ~~**Server-Side Resume**~~: ✅ **FIXED (Session 31)** - Progress syncs to server, works across devices
- **Navigation Blocking**: No warning when leaving quiz with unsaved answers (requires data router migration, but autosave now makes this less critical)
- **Rich Text Editor**: ClassNotes uses plain textarea (could upgrade to TipTap/Lexical)
- **Real-time Updates**: Results page doesn't subscribe to new attempts
- **E2E Testing**: No Playwright/Cypress specs yet

### Fixed in Session 27
- ✅ **Dangling Attempts**: QuizPage now detects in_progress attempts (prevents database pollution)
- ✅ **Schema Mismatch**: Both flows use `responses: Record<string, string>` per schema

---

## Quick Links

- **System Design**: [Architecture.md](./Architecture.md)
- **API Contracts**: [API_Reference.md](./API_Reference.md)
- **Feature Specs**: [Features.md](./Features.md)
- **Design System**: [Design_System.md](./Design_System.md)
- **Security Rules**: [Security_Rules.md](./Security_Rules.md)
- **ESM Guidelines**: [ESM_Rules.md](./ESM_Rules.md)
- **Session History**: [/docs/archive/sessions/](../archive/sessions/)

---

**Last Verified**: January 3, 2026 (Session 39 - API error resilience complete)
**Next Review**: After production monitoring + P0-B planning
**Build Status**: ✅ Passing (0 TypeScript errors, 619.02 kB gzip: 173.66 kB)
**Recent Sessions**: [Session 36](./SESSION_36.md), [Session 37](./SESSION_37.md), [Session 38](./SESSION_38.md), [Session 39](./SESSION_39.md)
