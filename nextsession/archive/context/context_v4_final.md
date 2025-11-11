# ChatGPA — Context v4

**Date**: 2025-10-26
**Status**: Active (post-verification, alpha-ready)
**Previous Version**: 2025_10_21_context_v3_final.md
**Last Session**: [HANDOFF_2025_10_26_VERIFICATION_SESSION.md](../handoffs/HANDOFF_2025_10_26_VERIFICATION_SESSION.md)

---

## Mission

ChatGPA turns messy student notes into organized, adaptive study sessions.

**MVP Flow**: Upload notes → Generate quiz → Take quiz → Adaptive grading → View results + feedback

**Current Phase**: Alpha preparation (backend production-ready, frontend needs 6 bug fixes)

---

## Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind
- **Backend**: Vercel Functions (`/api/*.ts`)
- **Database/Auth/Storage**: Supabase (Postgres + Auth + Storage with RLS)
- **Payments**: Stripe (Monthly $9 + Annual $79)
- **AI**: OpenAI GPT-5 (quiz generation + grading)

**Note**: Anthropic Claude integration deferred to post-alpha (no API key yet)

---

## Frontend Routes

### Active Pages
- `/` - Landing page with magic link auth
- `/dashboard` - Class list + recent quiz attempts
- `/generate` - Quiz generation from notes (paste text)
- `/quiz/:id` - Quiz taking page (MCQ + short answer)

### Removed (Carpool Legacy)
- `/chat`, `/account`, `/pricing`, `/debug` - All deprecated and removed

### Status
- ✅ Landing: Environment-safe auth redirects with `VITE_APP_URL`
- ⚠️ Dashboard: Has import path + letter field + score display bugs
- ⚠️ Generate: Has import path + session guard + LIMIT_EXCEEDED bugs
- ⚠️ QuizPage: Has import path + session guard bugs
- 📋 All fixes documented in `VERIFICATION_REPORT_2025_10_26.md`

---

## API Routes

### Implemented (Production-Ready ✅)

**`/api/generate-quiz`** - Generate quiz from notes
- **Input**: `{ class_id: uuid, notes_text: string(20-50000) }`
- **Output**: `{ quiz_id: uuid }`
- **Errors**: LIMIT_EXCEEDED (429), SCHEMA_INVALID (400), NOT_FOUND (404), UNAUTHORIZED (401), OPENAI_ERROR (500), SERVER_ERROR (500)
- **Auth**: Bearer token (Supabase access token)
- **Limits**: Free tier max 5 quizzes (via live count)
- **Model**: OpenAI GPT-5 (centralized via `_lib/ai.ts`)
- **Security**: RLS-enabled anon client, no service role

**`/api/grade`** - Grade quiz answers
- **Input**: `{ quiz_id: uuid, answers: [{ questionId, answer }] }`
- **Output**: `{ score: 0-100, letter: "F"|"D"|"C"|"B"|"A"|"A+", feedback: [...], summary: string, attempt_id: uuid }`
- **Errors**: Same as generate-quiz
- **Auth**: Bearer token (Supabase access token)
- **Grading**: Temperature=0 for deterministic results
- **Storage**: Stores score as 0..1 in DB, returns 0-100 to client
- **Security**: Quiz ownership verified via RLS

### Stripe (Existing)
- `/api/create-checkout-session` - Stripe checkout (auth required)
- `/api/stripe-webhook` - Webhook handler (signature verified)

### Removed (Carpool Legacy)
- `/api/chat/*` - All chat/token/fuel endpoints removed
- `/api/monthly-rollover` - Moved to `disabled_api/consolidated/`

### Shared Utilities
- `_lib/ai.ts` - Centralized MODEL configuration
- `_lib/validation.ts` - Error codes, ok/err helpers, structured logging
- `_lib/usage.ts` - Live count limit checks (canCreateClass, canGenerateQuiz)

---

## Database Schema (Supabase)

### Core Tables

**`classes`**
```sql
id          uuid PRIMARY KEY
user_id     uuid REFERENCES auth.users(id)
name        text
description text
created_at  timestamptz
```

**`quizzes`**
```sql
id          uuid PRIMARY KEY
user_id     uuid REFERENCES auth.users(id)
class_id    uuid REFERENCES classes(id)
notes_id    uuid REFERENCES notes(id)  -- optional
questions   jsonb  -- Array of Question objects
meta        jsonb
created_at  timestamptz
```

**`quiz_attempts`**
```sql
id          uuid PRIMARY KEY
quiz_id     uuid REFERENCES quizzes(id)
user_id     uuid REFERENCES auth.users(id)
responses   jsonb  -- { questionId: userAnswer }
grading     jsonb  -- Array of PerQuestionFeedback
score       numeric  -- 0..1 (display as 0-100)
created_at  timestamptz
```

**Note**: `letter` is NOT stored in DB (computed client-side or in API response only)

**`subscriptions`**
```sql
user_id                 uuid PRIMARY KEY REFERENCES auth.users(id)
tier                    enum('free', 'monthly', 'annual')
status                  text
stripe_customer_id      text
stripe_subscription_id  text
current_period_end      timestamptz
cancel_at_period_end    boolean
created_at              timestamptz
updated_at              timestamptz
```

**`usage_limits`** (cache only, not source of truth)
```sql
user_id         uuid PRIMARY KEY REFERENCES auth.users(id)
classes_created int DEFAULT 0
quizzes_taken   int DEFAULT 0  -- Note: API uses "quizzes created"
updated_at      timestamptz
```

**Important**: Free tier limits are enforced via **live counts** on tables, not `usage_limits` counters (prevents drift).

### Question Schema (JSONB in `quizzes.questions`)

```typescript
// MCQ Question
{
  id: string;              // e.g. "q1"
  type: 'mcq';
  prompt: string;          // Max 180 chars
  options: string[];       // 3-5 options
  answer: string;          // Must match one option exactly
}

// Short Answer Question
{
  id: string;
  type: 'short';
  prompt: string;          // Max 180 chars
  answer: string;          // Gold standard answer
}
```

### RLS Policies

- **Users**: Can read/write own rows in `classes`, `quizzes`, `quiz_attempts`
- **Service role**: Used ONLY for Stripe webhook operations
- **API routes**: Use anon client + user access token (RLS auto-enforces user_id scoping)
- **Storage**: `notes-files` bucket with path prefix = `<user_id>/`

---

## Environment Variables

### Supabase
```env
VITE_SUPABASE_URL=https://lpdezsogcubuvezkdkxu.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_key>  # Webhook only
```

### OpenAI
```env
OPENAI_API_KEY=sk-proj-...
# OPENAI_MODEL=gpt-5  # Optional override (defaults to gpt-5 in code)
```

### Stripe
```env
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY_TEST=price_test_...
STRIPE_PRICE_MONTHLY_LIVE=price_live_...
STRIPE_PRICE_ANNUAL_TEST=price_test_...
STRIPE_PRICE_ANNUAL_LIVE=price_live_...
APP_MODE=test  # or "live" (controls Stripe key selection)
```

### App
```env
VITE_APP_URL=http://localhost:5173  # Auth redirects
VITE_APP_NAME=ChatGPA
```

### Note on APP_MODE
- **Stripe routes** use `APP_MODE` to select TEST/LIVE keys
- **OpenAI routes** do NOT use `APP_MODE` (single key only)
- This is by design (quiz generation/grading doesn't need staging/prod split)

---

## Free Tier Limits

### Enforced via Live Counts
- **Max Classes**: 1 (counted via `SELECT count(*) FROM classes WHERE user_id = ...`)
- **Max Quizzes Created**: 5 (counted via `SELECT count(*) FROM quizzes WHERE user_id = ...`)

### Error Handling
- Returns `{ code: "LIMIT_EXCEEDED", message: "..." }` with 429 status
- Frontend should show upgrade CTA (currently missing - see Known Issues)

### Cache Table
- `usage_limits` is updated AFTER successful operations (optional)
- Source of truth is always live counts (prevents drift)

---

## Implementation Status

### ✅ Complete (Production-Ready)

**Backend**:
- [x] `/api/generate-quiz` - All contracts met, RLS enforced, live count limits
- [x] `/api/grade` - Deterministic grading, letter calculation, attempt storage
- [x] Centralized MODEL config (`_lib/ai.ts`)
- [x] Error handling (`_lib/validation.ts`)
- [x] Usage limits (`_lib/usage.ts`)
- [x] JSON parse guards before Zod
- [x] Structured logging with request_id
- [x] Single `OPENAI_API_KEY` usage (no _TEST/_LIVE branching)

**Frontend**:
- [x] Landing page with `VITE_APP_URL` safety
- [x] Dashboard page (has bugs, needs fixes)
- [x] Generate page (has bugs, needs fixes)
- [x] QuizPage (has bugs, needs fixes)
- [x] Toast notification component
- [x] Layout components (AppLayout, MarketingLayout)

**Infrastructure**:
- [x] .gitignore updated (session docs excluded)
- [x] Git branch pushed (`chore/prune-carpool-ui-api`)
- [x] PR documentation ready
- [x] Verification report created

### ⚠️ Known Issues (Must Fix Before Alpha)

**Critical (6 bugs documented in VERIFICATION_REPORT_2025_10_26.md)**:

1. **Import paths** - 3 files use `@/lib/supabaseClient` (should be `@/lib/supabase`)
2. **Session guards** - 2 files missing null checks before using `access_token!`
3. **Dashboard letter field** - Tries to read non-existent `letter` from DB
4. **Dashboard score** - Missing `* 100` multiplication (shows 0.85% instead of 85%)
5. **LIMIT_EXCEEDED handling** - No special error case in generate.tsx
6. **Notes validation** - Missing max 50k char check

**Estimated Fix Time**: 45-60 minutes (all patches ready in verification report)

### 🚧 Deferred to Post-Alpha

- [ ] `/api/summarize` - Notes summarization (optional feature)
- [ ] PDF upload (notes are paste-only for MVP)
- [ ] Anthropic Claude integration (no API key yet)
- [ ] Automated integration tests
- [ ] E2E tests (Playwright/Cypress)
- [ ] OpenAI SDK refactor (v6, currently uses fetch())

---

## Contracts & Non-Negotiables

### API Error Shape
**ALL** non-200 responses must use this exact shape:
```typescript
{ code: string, message: string }
```

**Allowed Error Codes**:
- `LIMIT_EXCEEDED` - Free tier limit hit (429)
- `SCHEMA_INVALID` - Invalid input or output (400)
- `NOT_FOUND` - Resource not found (404)
- `OPENAI_ERROR` - OpenAI API failure (500)
- `UNAUTHORIZED` - Missing/invalid auth (401)
- `SERVER_ERROR` - Internal error (500)

### Security
- ❌ **No service role keys** in quiz routes (webhook only)
- ✅ **RLS enforced** via anon client + user token
- ✅ **User_id scoping** automatic via RLS policies
- ✅ **Bearer token** in Authorization header

### Data Integrity
- ✅ **Live counts** for limits (not cached counters)
- ✅ **Zod validation** for all inputs/outputs
- ✅ **JSON parse guards** before validation
- ✅ **Score storage** as 0..1 (display as 0-100)
- ❌ **No letter field** in quiz_attempts table (compute client-side)

---

## Testing Checklist

### Manual Smoke Tests (Before Merge)

**Happy Path**:
- [ ] Sign in with magic link
- [ ] Create class
- [ ] Paste notes (1-3k chars)
- [ ] Generate quiz
- [ ] Answer questions
- [ ] Submit for grading
- [ ] Verify score/letter/feedback display

**Limit Test**:
- [ ] Create 6th quiz
- [ ] Verify 429 LIMIT_EXCEEDED response
- [ ] Verify upgrade CTA shown (after fix)

**Auth Test**:
- [ ] Sign out
- [ ] Verify protected pages redirect
- [ ] Sign in again
- [ ] Verify session persists

**RLS Test**:
- [ ] Create quiz as User A
- [ ] Try to access with User B's token
- [ ] Verify 404 or 401 (RLS blocks)

### Automated Tests (Post-Alpha)
- [ ] API route unit tests
- [ ] Frontend component tests
- [ ] Integration tests (API → DB → UI)
- [ ] E2E tests (full user flows)

---

## Git & Deployment

### Current Branch
**Name**: `chore/prune-carpool-ui-api`
**Status**: Pushed to remote, ready for PR
**Commits**: 2 (e3fa763 implementation, 12fdc1d cleanup)
**PR URL**: https://github.com/HaiDaPlug/chatgpa/pull/new/chore/prune-carpool-ui-api

### Files Tracked
- ✅ All implementation code (API routes, pages, components)
- ✅ Configuration files (.gitignore, package.json, tsconfig, etc.)
- ✅ Root README, setup docs

### Files Local Only (Gitignored)
- `handoffs/` - Session handoffs
- `docs/` - Context files, verification reports
- `prompts/` - AI prompts (QUIZ_GENERATOR, GRADER, Claude_Prompt)
- `nextsession/` - Session preparation files
- `build-plan/` - Planning documents
- `revise.md` - Verification spec

---

## Next Session Plan

### Immediate (45-60 min)
1. **Apply 6 frontend patches** from VERIFICATION_REPORT_2025_10_26.md
   - Fix import paths (3 files)
   - Add session guards (2 files)
   - Fix dashboard letter/score (1 file)
   - Add LIMIT_EXCEEDED handling (1 file)
   - Add notes max validation (1 file)

2. **Run manual smoke tests** (15-20 min)
   - Happy path end-to-end
   - Free tier limit enforcement
   - Auth redirect testing
   - RLS verification

3. **Merge PR to main** (if tests pass)

### Post-Merge
4. **Deploy to Vercel staging**
5. **Test in preview environment**
6. **Deploy to production** (if staging passes)

---

## Documentation

### Active Files (Local)
- **This file** - Current context and source of truth
- [HANDOFF_2025_10_26_VERIFICATION_SESSION.md](../handoffs/HANDOFF_2025_10_26_VERIFICATION_SESSION.md) - Latest session
- [VERIFICATION_REPORT_2025_10_26.md](VERIFICATION_REPORT_2025_10_26.md) - Full verification results
- [revise.md](../revise.md) - Verification spec

### Referenced Files
- [CONTEXT_API_IMPLEMENTATION_2025_10_22.md](../nextsession/CONTEXT_API_IMPLEMENTATION_2025_10_22.md) - API implementation context

---

## Rules of Truth

1. **This file is the current source of truth** for app scope, architecture, and status.
2. If any document conflicts with this file, **this file wins**.
3. **Verification reports** provide evidence for claims in this context.
4. **Session handoffs** provide historical context but are superseded by this file.
5. **Code is the ultimate truth** - if docs and code disagree, investigate and update docs.

---

## Key Decisions Log

**2025-10-26**:
- ✅ Gitignore session docs (keep local, don't push)
- ✅ Use live counts for limits (not usage_limits cache)
- ✅ Store letter grade computation client-side (don't store in DB)
- ✅ Use single OPENAI_API_KEY (no _TEST/_LIVE split)
- ✅ Defer SDK refactor to v6 (use fetch() for v5)

**2025-10-22**:
- ✅ Backend contracts locked (error shape, codes, RLS)
- ✅ Free tier: 1 class, 5 quizzes created
- ✅ Landing.tsx uses VITE_APP_URL for env-safe redirects

**2025-10-21**:
- ✅ Prune all Carpool UI/API (chat, account, pricing, debug)
- ✅ Keep Stripe integration (checkout + webhook)
- ✅ Migrate from Carpool to ChatGPA schema

---

## Metrics

### Code
- **API Routes**: 2 implemented, 1 deprecated (moved)
- **Frontend Pages**: 4 active (landing, dashboard, generate, quiz)
- **Shared Utilities**: 3 (_lib/ai, validation, usage)
- **Components**: 3 (Toast, AppLayout, MarketingLayout)

### Documentation
- **Context Files**: 4 versions (v1-v4)
- **Session Handoffs**: 5 total
- **Verification Reports**: 1 comprehensive
- **Total Doc Lines**: ~3,500 lines

### Git
- **Commits**: 2 on current branch
- **Files Changed**: 32 (last commit)
- **Lines Added**: +1,663
- **Lines Removed**: -2,284
- **Net Change**: -621 (pruning + new features)

---

**Last Updated**: 2025-10-26
**Next Review**: After 6 frontend bugs fixed
**Status**: Alpha-ready (pending frontend patches)
**Blocker Count**: 6 (all documented with solutions)
