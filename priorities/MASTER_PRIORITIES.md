# ChatGPA - Master Priorities (Consolidated)

**Last Updated**: December 30, 2025
**Status**: Post-Session 33 (Bulletproofing Complete)
**Current State**: Backend world-class, UX polished, ready for production hardening

---

## 🎯 CRITICAL (Blocking Production Beta)

### 1. Rate Limiting & Abuse Guards ⚡
**Why Critical**: No protection against API abuse, cost control vulnerability
**What's Missing**:
- AI endpoints (`/api/v1/ai`) unprotected (can burn through OpenAI credits)
- Folder CRUD endpoints have no limits (spam creates)
- No per-user throttling on quiz generation/grading

**Impact**: Production vulnerability, runaway costs, service degradation
**Implementation**: Redis-based limiter or Vercel Edge middleware
**Effort**: Medium
**Status**: 🔴 **BLOCKING BETA**

---

### 2. Observability & Error Tracking 📊
**Why Critical**: Production debugging impossible without proper logging
**What's Missing**:
- No centralized error tracking (Sentry/Datadog)
- Server logs exist but not structured/queryable
- No alerting on critical failures (generation/grading errors)
- No request tracing for debugging user issues

**Impact**: "Production becomes chaos" without visibility
**Implementation**: Sentry integration + structured logging
**Effort**: Medium
**Status**: 🔴 **BLOCKING BETA**

---

### 3. Usage Limits Enforcement + UX 💳
**Why Critical**: Free plan caps not actually enforced, no upgrade path
**What's Missing**:
- Current: 5 quiz limit exists but needs verification
- No clear messaging when user hits limit
- No "Upgrade to Pro" CTA in limit-hit flow
- Need to verify enforcement works across all entry points

**Impact**: Revenue loss, user confusion, "why can't I generate?" support tickets
**Implementation**: Verify enforcement + add upgrade UI
**Effort**: Low
**Status**: 🔴 **BLOCKING BETA**

---

### 4. Attempts Lifecycle Integrity 🔄
**Why Critical**: Prevent weird states, partial grading, data corruption
**What's Missing**:
- Session 27 fixed dangling `in_progress` attempts, but need verification
- Idempotency on submit (prevent double-grading if user clicks twice)
- Retry logic for transient failures (OpenAI timeouts)
- Recovery from partial grading failures

**Impact**: User frustration, data inconsistency, support burden
**Implementation**: Idempotency keys + transaction safety
**Effort**: Medium
**Status**: 🟡 **NEEDS VERIFICATION**

---

### 5. Security Sanity Pass 🔒
**Why Critical**: RLS assumptions need verification, input validation gaps
**What's Missing**:
- RLS policies verified but need penetration testing
- Payload size caps (prevent 50MB note uploads)
- Input validation beyond Zod (sanitization, injection prevention)
- Safe defaults on all endpoints

**Impact**: Security breach, data leaks, service abuse
**Implementation**: Security audit + hardening
**Effort**: Medium
**Status**: 🟡 **NEEDS AUDIT**

---

### 6. API Bulletproofing 🛡️
**Why Critical**: `/api/v1/ai` endpoints need consistent error handling
**What's Missing**:
- Zod validation exists but error messages need UX improvement
- Timeouts configured but need testing under load
- Consistent `{ code, message }` shape verified
- Good failure UX (retryable errors vs permanent failures)

**Impact**: User confusion on errors, poor recovery flows
**Implementation**: Error message audit + timeout testing
**Effort**: Low
**Status**: 🟡 **NEEDS POLISH**

---

## 🚀 MUST HAVE (Production Launch Blockers)

### 7. Stripe End-to-End 💰
**Why Important**: Can't launch paid tiers without working billing
**What's Missing**:
- Subscribe/upgrade/cancel flows
- Webhook handling (subscription events)
- Subscription status sync to `subscriptions` table
- Portal integration for self-service management

**Impact**: No revenue, can't scale beyond free tier
**Implementation**: Full Stripe integration
**Effort**: High
**Status**: 🟡 TODO

---

### 8. Legal Basics 📜
**Why Important**: Required for public launch, GDPR/CCPA compliance
**What's Missing**:
- Privacy Policy
- Terms of Service
- Cookie notice (if using analytics cookies)
- Data retention/deletion policy

**Impact**: Legal risk, can't market publicly
**Implementation**: Legal templates + review
**Effort**: Low (templates) → Medium (legal review)
**Status**: 🟡 TODO

---

### 9. Onboarding Clarity 🎓
**Why Important**: "First quiz success in <2 minutes" requirement
**What's Missing**:
- Empty state guidance (every dead end → next step)
- First-run flow optimization (create class → paste notes → generate)
- Progress indicators during generation
- Success celebration on first completed quiz

**Impact**: User drop-off, "I don't get it" abandonment
**Implementation**: Empty states + first-run UX
**Effort**: Medium
**Status**: 🟡 TODO

---

### 10. Recovery & Support Flows 🆘
**Why Important**: Users get stuck, need self-service recovery
**What's Missing**:
- Reset flows (forgot password exists, needs testing)
- Resend email verification
- "Contact support" path
- FAQ/Help center

**Impact**: Support burden, user frustration
**Implementation**: Self-service flows + help docs
**Effort**: Low
**Status**: 🟡 TODO

---

### 11. Performance Polish ⚡
**Why Important**: No jank on low-end devices, smooth UX
**What's Missing**:
- Loading states on all async operations (some exist, needs audit)
- Skeleton loaders vs spinners consistency
- Optimistic UI updates (immediate feedback)
- Bundle size optimization (current: 616.42 kB gzipped)

**Impact**: Perceived performance, mobile UX quality
**Implementation**: Loading state audit + lazy loading
**Effort**: Medium
**Status**: 🟡 TODO

---

## 💎 SHOULD HAVE (Competitive Differentiation)

### 12. Retake Analytics Dashboard 📈
**Why Important**: Session 27 added true retake, need visibility into adoption
**What's Missing**:
- Retake → completion rate tracking
- Average score improvement metrics
- Perfect score rate on 2nd+ attempts
- User engagement with mastery loop
- Weak topic identification

**Impact**: Data-driven mastery loop optimization
**Foundation**: Telemetry events already exist (Session 27)
**Effort**: Medium
**Status**: 🟡 TODO

---

### 13. Question Quality Consistency 🎯
**Why Important**: Avoid vague/ambiguous questions, ensure defensible answers
**What's Missing**:
- Auto QA pass after generation (sanity grader)
- Flag ambiguous questions
- Detect missing/unclear correct answers
- Duplicate question detection (already computed in quality metrics)
- Word count validation (already added in Session 33)

**Impact**: User trust, fewer "this question is unfair" complaints
**Implementation**: Lightweight AI QA pass
**Effort**: High
**Status**: 🟡 TODO

---

### 14. Feedback Quality Improvements 💬
**Why Important**: Actionable, specific feedback → better learning outcomes
**What's Missing**:
- One-sentence "why you got it wrong" (currently paragraph-heavy)
- "Next time, do this" suggestion (concrete action)
- Partial credit transparency ("Correct idea, missing X")
- Wrong-answer pattern detection (after results)
- Confidence check ("How sure were you?")

**Impact**: Premium feel, "this app teaches me" perception
**Foundation**: Rubric grading already solid (Section 2)
**Effort**: High (AI prompt engineering)
**Status**: 🟡 TODO

---

### 15. Question Diversity Improvements 🎲
**Why Important**: Mix of recall + apply + explain question types
**What's Missing**:
- Ensure variety beyond MCQ vs typing
- Bloom's taxonomy targeting (remember/understand/apply/analyze)
- Difficulty distribution enforcement
- Concept coverage verification (already in quality metrics)

**Impact**: Better assessment quality, closer to real exams
**Implementation**: Generation prompt tuning
**Effort**: Medium
**Status**: 🟡 TODO

---

### 16. Practice Modes (First-Class) 🔄
**Why Important**: Mastery loop retention ("redo until mastery")
**What's Missing**:
- ✅ Practice incorrect (done in Session 33)
- Practice "weak topics" (tag-based grouping)
- "Same concept, new question" mode (avoid memorization)
- Spaced repetition scheduling

**Impact**: User retention, study habit formation
**Foundation**: Session 33 Practice Incorrect + Shuffle
**Effort**: Medium → High
**Status**: 🟢 **P1 DONE**, 🟡 P2/P3 TODO

---

### 17. Progress & History Loop 📊
**Why Important**: Streak tracking, "continue studying" CTA
**What's Missing**:
- Last studied timestamp per class
- Weakest class identification
- Study streak counter
- "Continue studying" dashboard CTA
- Attempt history timeline (not analytics porn, just simple)

**Impact**: Habit formation, return visits
**Implementation**: Dashboard widgets + metrics
**Effort**: Medium
**Status**: 🟡 TODO

---

### 18. Score Comparison Chart 📈
**Why Important**: Visual motivation for mastery loop
**What's Missing**:
- Attempt 1 vs 2 vs 3 score visualization
- Retake count badge on quiz cards
- "Study Suggestions" based on weak patterns
- Progress over time graph

**Impact**: Gamification, engagement boost
**Foundation**: Session 27 true retake enables this
**Effort**: Medium
**Status**: 🟡 TODO

---

### 19. Input Quality Checks (Smart Warnings) ⚠️
**Why Important**: Proactive quality control before generation
**What's Missing**:
- ✅ Word count warning (done in Session 33)
- "Too many topics" detection
- "No structure" warning (all text, no headings)
- Suggest note improvements before generating
- Missing material analysis (gap detection)

**Impact**: Better quiz quality, fewer "bad question" issues
**Foundation**: Session 33 added word count validation
**Effort**: Medium
**Status**: 🟢 **P1 DONE**, 🟡 P2/P3 TODO

---

### 20. Navigation Blocking 🚧
**Why Important**: Prevent accidental navigation away mid-quiz
**What's Missing**:
- Migrate from `<BrowserRouter>` to `createBrowserRouter`
- Implement `useBlocker` on QuizPage
- "You have unsaved answers" warning dialog

**Impact**: UX safety net (less critical since Session 31 autosave)
**Effort**: Low
**Status**: 🟡 TODO (lower priority)

---

## 🌟 NICE TO HAVE (Polish & Scale)

### 21. Design System Overhaul 🎨
**Why Nice**: Consistency across pages, modern feel
**What's Missing**:
- Navbar improvements (mentioned in brain dump)
- Page-by-page design polish (Gemini pass)
- Design system documentation
- Component library consistency

**Impact**: Visual polish, brand cohesion
**Effort**: High
**Status**: 🟡 TODO

---

### 22. Rich Text Editor ✍️
**Why Nice**: Current textarea is basic
**What's Missing**:
- TipTap or Lexical editor
- Markdown support (headings, lists, code blocks)
- Formatting toolbar (bold, italic, highlights)
- Image/diagram embedding

**Impact**: Better notes → better quizzes
**Effort**: High
**Status**: 🟡 TODO

---

### 23. Real-Time Updates 🔄
**Why Nice**: Results page doesn't reflect new attempts without refresh
**What's Missing**:
- Supabase realtime subscriptions on `quiz_attempts`
- Live score updates on Results page
- Toast notification "New quiz graded!"

**Impact**: Feels more responsive (especially for retakes)
**Effort**: Medium
**Status**: 🟡 TODO

---

### 24. E2E Testing 🧪
**Why Nice**: Catch regressions before production
**What's Missing**:
- Playwright or Cypress test suite
- Critical flows: signup → upload notes → generate → take → submit
- Visual regression testing

**Impact**: Confidence in deployments
**Effort**: High
**Status**: 🟡 TODO

---

### 25. Bundle Size Optimization 📦
**Why Nice**: Faster initial load
**What's Missing**:
- Lazy loading routes with `React.lazy()`
- Code splitting per route
- Tree-shaking unused dependencies
- Current: 616.42 kB gzipped (Session 33)

**Impact**: Marginal performance improvement (already fast)
**Effort**: Medium
**Status**: 🟡 TODO

---

### 26. Pagination for Large Classes 📄
**Why Nice**: ClassNotes loads all notes at once
**What's Missing**:
- Virtual scrolling or cursor-based pagination
- Only critical for 100+ notes per class
- Current: Works fine for typical use (< 50 notes)

**Impact**: Edge case performance
**Effort**: Low
**Status**: 🟡 TODO

---

### 27. Advanced Feedback Features 💡
**Why Nice**: Premium teaching features
**What's Missing**:
- "Explain like I'm teaching a friend" prompt
- Catch and fix trick questions (auto-correction)
- Confidence-weighted scoring
- Multi-attempt partial credit

**Impact**: Premium feel, user delight
**Effort**: High (AI complexity)
**Status**: 🟡 TODO

---

## 📋 Priority Matrix

| Rank | Feature | Category | Impact | Effort | Status |
|------|---------|----------|--------|--------|--------|
| 1 | Rate Limiting | CRITICAL | Critical | Medium | 🔴 BLOCKING |
| 2 | Observability | CRITICAL | Critical | Medium | 🔴 BLOCKING |
| 3 | Usage Limits UX | CRITICAL | Critical | Low | 🔴 BLOCKING |
| 4 | Attempts Integrity | CRITICAL | High | Medium | 🟡 VERIFY |
| 5 | Security Audit | CRITICAL | High | Medium | 🟡 VERIFY |
| 6 | API Bulletproofing | CRITICAL | High | Low | 🟡 POLISH |
| 7 | Stripe End-to-End | MUST HAVE | Critical | High | 🟡 TODO |
| 8 | Legal Basics | MUST HAVE | High | Low | 🟡 TODO |
| 9 | Onboarding Clarity | MUST HAVE | High | Medium | 🟡 TODO |
| 10 | Recovery Flows | MUST HAVE | Medium | Low | 🟡 TODO |
| 11 | Performance Polish | MUST HAVE | Medium | Medium | 🟡 TODO |
| 12 | Retake Analytics | SHOULD HAVE | High | Medium | 🟡 TODO |
| 13 | Question Quality | SHOULD HAVE | High | High | 🟡 TODO |
| 14 | Feedback Quality | SHOULD HAVE | High | High | 🟡 TODO |
| 15 | Question Diversity | SHOULD HAVE | Medium | Medium | 🟡 TODO |
| 16 | Practice Modes | SHOULD HAVE | High | Medium | 🟢 P1 DONE |
| 17 | Progress History | SHOULD HAVE | Medium | Medium | 🟡 TODO |
| 18 | Score Charts | SHOULD HAVE | Medium | Medium | 🟡 TODO |
| 19 | Input Quality | SHOULD HAVE | Medium | Medium | 🟢 P1 DONE |
| 20 | Navigation Blocking | SHOULD HAVE | Low | Low | 🟡 TODO |
| 21 | Design Overhaul | NICE TO HAVE | Medium | High | 🟡 TODO |
| 22 | Rich Text Editor | NICE TO HAVE | Medium | High | 🟡 TODO |
| 23 | Real-Time Updates | NICE TO HAVE | Low | Medium | 🟡 TODO |
| 24 | E2E Testing | NICE TO HAVE | Low | High | 🟡 TODO |
| 25 | Bundle Optimization | NICE TO HAVE | Low | Medium | 🟡 TODO |
| 26 | Pagination | NICE TO HAVE | Low | Low | 🟡 TODO |
| 27 | Advanced Feedback | NICE TO HAVE | Low | High | 🟡 TODO |

---

## 🎯 Recommended Execution Order

### Phase 0: Production Beta (6 priorities)
**Goal**: Public link, free users, stable core loop

1. Rate Limiting & Abuse Guards
2. Observability & Error Tracking
3. Usage Limits UX
4. Attempts Lifecycle Verification
5. Security Sanity Pass
6. API Bulletproofing

**Outcome**: Can ship a real beta without fear

---

### Phase 1: Production Launch (5 priorities)
**Goal**: Paying users, "I can market this hard"

7. Stripe End-to-End
8. Legal Basics
9. Onboarding Clarity
10. Recovery Flows
11. Performance Polish

**Outcome**: Full production-ready, monetizable

---

### Phase 2: Competitive Edge (8 priorities)
**Goal**: World-class quiz generator differentiation

12. Retake Analytics Dashboard
13. Question Quality Consistency
14. Feedback Quality Improvements
15. Question Diversity
16. Practice Modes (P2/P3)
17. Progress & History Loop
18. Score Comparison Chart
19. Input Quality Checks (P2/P3)

**Outcome**: Premium product that users love and retain

---

### Phase 3: Scale & Polish (7 priorities)
**Goal**: Long-term growth infrastructure

20. Navigation Blocking
21. Design System Overhaul
22. Rich Text Editor
23. Real-Time Updates
24. E2E Testing
25. Bundle Optimization
26. Pagination
27. Advanced Feedback Features

**Outcome**: Polished, scalable, enterprise-ready

---

## ✅ Recently Completed (Context)

- ✅ **Session 33**: Bulletproofing (Practice Incorrect, Shuffle, Trust Layer, Warnings)
- ✅ **Session 32**: Modern Results Page UI (AttemptReview component)
- ✅ **Session 31**: Server-Side Autosave + Resume Fix
- ✅ **Session 30**: Sidebar Stretching Fix
- ✅ **Session 29**: localStorage Persistence
- ✅ **Session 28**: Persistent Quiz Summary Card
- ✅ **Session 27**: True Retake Quiz (Mastery Loop)

---

## 📝 Notes

**What's Already World-Class**:
- AI Router with fallback (Section 1)
- Rubric grading system (Section 2)
- RLS security architecture
- Folder workspace (Section 5)
- Theme System V2 (Section 7)
- Quiz configuration system (Section 4)
- Results autosave with conflict resolution (Section 3)

**Current Gaps**: Mostly **production hardening**, **analytics visibility**, **billing integration**, and **UX polish**.

**Philosophy**: Simple + great quiz generator. Focus on **spot-on questions** + **grading** + **feedback** before adding complexity.

---

**Last Updated**: December 30, 2025
**Next Review**: After Production Beta (Phase 0) completion
**Source Files**: `priorities_to_production.md`, `world_class_infra.md`, `world_class_priorities_chatgpt.md`, `improvements_later.md`, `world_class_status.md`
