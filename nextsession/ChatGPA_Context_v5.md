# ChatGPA — Context v5

**Date**: 2025-11-11
**Status**: Active (Sessions 9-13 complete, production-ready)
**Previous Version**: context_v4_final.md (2025-10-26)
**Current Branch**: `fix/class-insert`
**Latest Completed**: Section 5 (Class Workspace with Folders — All 9 Phases)

---

## Mission

ChatGPA turns messy student notes into organized, adaptive study sessions.

**MVP Flow**: Upload notes → Generate quiz → Take quiz → Adaptive grading → View results + feedback

**Current Phase**: Production-ready with advanced features (AI Router, Grading System, Quiz Config, Visual System Foundation, Folder Workspace)

---

## Tech Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: Vercel Functions (`/api/*.ts`)
- **Database/Auth/Storage**: Supabase (Postgres + Auth + Storage with RLS)
- **Payments**: Stripe (Monthly $9 + Annual $79)
- **AI**: OpenAI (gpt-4o-mini, gpt-5-mini with automatic fallback)

---

## Frontend Routes

### Active Pages
- `/` - Landing page with magic link auth
- `/dashboard` - Class list + recent quiz attempts
- `/generate` - Quiz generation from notes (paste text)
- `/quiz/:id` - Quiz taking page (MCQ + typing questions)
- `/results/:attemptId` - Results page with autosave and conflict resolution
- `/classes/:classId/notes` - Class workspace with folder-based organization

### Status
- ✅ All core pages implemented
- ✅ Token-based styling (CSS custom properties)
- ✅ RLS enforcement throughout
- ✅ Feature flags for new features

---

## API Routes

### Section 1: Generation & Analytics

**`/api/generate-quiz`** (Session 7)
- **Input**: `{ class_id: uuid, notes_text: string(20-50000), config?: QuizConfig }`
- **Output**: `{ quiz_id: uuid }`
- **Auth**: Bearer token (Supabase access token)
- **Model**: AI Router with automatic fallback (gpt-4o-mini → gpt-5-mini)
- **Config**: Optional quiz config from Section 4 (stored in `quizzes.meta`)
- **Analytics**: Tracks model_used, tokens, latency, quality_metrics to unified `analytics` table

**`/api/analytics`** - POST analytics events
- **Input**: `{ event_type, data: jsonb }`
- **Storage**: Unified analytics table with JSONB data field
- **Pattern**: Fire-and-forget (non-blocking)

### Section 2: Grading System

**`/api/grade`** (Session 8)
- **Input**: `{ quiz_id: uuid, answers: [{ questionId, answer }] }`
- **Output**: `{ score: 0-100, letter: "F"|"D"|"C"|"B"|"A"|"A+", feedback: [...], summary: string, attempt_id: uuid }`
- **Auth**: Bearer token
- **Model Selection**:
  - MCQ/Short answers: gpt-4o-mini (temp 0.1)
  - Long answers: gpt-5-mini (reasoning model, no temp param)
- **Rubric Engine**: Length-agnostic scoring with weighted criteria:
  ```typescript
  RUBRIC_WEIGHTS = {
    coverage: 0.4,      // Concept coverage (primary)
    accuracy: 0.35,     // Factual correctness
    clarity: 0.15,      // Coherent organization
    conciseness: 0.1,   // Bonus for brevity (never penalty)
  }
  ```
- **Analytics**: Tracks model_used, rubric_scores, tokens, latency (fire-and-forget)

### Section 3: Results Page

**`/api/attempts/autosave`** - PATCH autosave responses
- **Input**: `{ attempt_id: uuid, responses: record }`
- **Output**: `{ ok: true, autosave_version: number, updated_at: timestamp }`
- **Features**:
  - Request size limit (500KB)
  - Increments autosave_version for conflict resolution
  - Fire-and-forget from client (non-blocking)

### Section 4: Quiz Configuration

**No new endpoints** — config passed directly to `/api/generate-quiz` as optional parameter

### Section 5: Folder Workspace (10 endpoints)

**Folder Queries:**
1. **`/api/folders/flat`** - GET flat list with optional note counts
2. **`/api/folders/tree`** - GET nested tree structure with lazy-load
3. **`/api/folders/path`** - GET breadcrumb path (avoids N+1 queries)

**Folder CRUD:**
4. **`/api/folders/create`** - POST create folder with circular ref check
5. **`/api/folders/update`** - PATCH rename/move/reorder
6. **`/api/folders/delete`** - DELETE with cascade options:
   - `?cascade=move-to-parent` - moves contents up one level
   - `?cascade=move-to-uncategorized` - removes all mappings
   - No param = 409 if not empty

**Note-Folder Mapping:**
7. **`/api/notes/add-to-folder`** - POST add note to folder (removes old mapping)
8. **`/api/notes/remove-from-folder`** - DELETE remove mapping (uncategorize)

**List Queries:**
9. **`/api/folders/notes`** - GET paginated notes in folder (cursor-based)
10. **`/api/classes/notes-uncategorized`** - GET notes without folder mapping

**All Section 5 endpoints:**
- Use anon Supabase client + RLS enforcement
- Bearer token auth required
- Consistent error shape: `{ code, message }`
- Pagination with cursor support (limit 20-100)

### Stripe (Existing)
- `/api/create-checkout-session` - Stripe checkout (auth required)
- `/api/stripe-webhook` - Webhook handler (signature verified)

### Shared Utilities
- **`_lib/ai-router.ts`** (Session 7) - Centralized AI router with model family detection and fallback
- **`_lib/rubric-engine.ts`** (Session 8) - Length-agnostic grading engine
- **`_lib/grading-analytics.ts`** (Session 8) - Fire-and-forget analytics
- **`_lib/quiz-config-schema.ts`** (Session 10) - Zod validation for quiz config
- **`_lib/prompt-builder.ts`** (Session 10) - Dynamic prompt generation from config
- **`_lib/validation.ts`** - Error codes, ok/err helpers, structured logging
- **`_lib/usage.ts`** - Live count limit checks

---

## Database Schema (Supabase)

### Core Tables

**`classes`**
```sql
id          uuid PRIMARY KEY
user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE
name        text NOT NULL
description text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

**`notes`**
```sql
id          uuid PRIMARY KEY
user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE
class_id    uuid REFERENCES classes(id) ON DELETE CASCADE
title       text
content     text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

**`quizzes`**
```sql
id          uuid PRIMARY KEY
user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE
class_id    uuid REFERENCES classes(id) ON DELETE CASCADE
notes_id    uuid REFERENCES notes(id) ON DELETE SET NULL
questions   jsonb NOT NULL  -- Array of Question objects
meta        jsonb DEFAULT '{}'::jsonb  -- Stores quiz config from Section 4
created_at  timestamptz DEFAULT now()
```

**`quiz_attempts`**
```sql
id                uuid PRIMARY KEY
quiz_id           uuid REFERENCES quizzes(id) ON DELETE CASCADE
user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE
responses         jsonb DEFAULT '{}'::jsonb  -- { questionId: userAnswer }
grading           jsonb  -- Array of PerQuestionFeedback
score             numeric  -- 0..1 (display as 0-100)
status            text DEFAULT 'in_progress'  -- 'in_progress' | 'completed'
autosave_version  int DEFAULT 0  -- For conflict resolution (Section 3)
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

**Note**: `letter` grade is NOT stored in DB (computed on-demand from score)

**`folders`** (Section 5)
```sql
id          uuid PRIMARY KEY
user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
class_id    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE
parent_id   uuid REFERENCES folders(id) ON DELETE CASCADE  -- Self-referencing for nesting
name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64)
sort_index  int NOT NULL DEFAULT 0
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()

-- Prevent circular references via trigger
```

**`note_folders`** (Section 5 - Many-to-many mapping)
```sql
note_id     uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE
folder_id   uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE
user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE  -- Denormalized for RLS
created_at  timestamptz DEFAULT now()

PRIMARY KEY (note_id, folder_id)
```

**`analytics`** (Unified table from Session 7-8)
```sql
id              uuid PRIMARY KEY
user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL
event_type      text NOT NULL  -- 'generation_analytics', 'grading_analytics', etc.
data            jsonb NOT NULL  -- Event-specific data
created_at      timestamptz DEFAULT now()

-- Indexes on user_id, event_type, created_at
```

**Backward compatibility view** (Session 7):
```sql
CREATE VIEW v_generation_analytics AS
  SELECT
    id, user_id, created_at,
    (data->>'quiz_id')::uuid as quiz_id,
    data->>'model_used' as model_used,
    -- ... other fields from data jsonb
  FROM analytics
  WHERE event_type = 'generation_analytics';
```

**`subscriptions`**
```sql
user_id                 uuid PRIMARY KEY REFERENCES auth.users(id)
tier                    text DEFAULT 'free'  -- 'free' | 'monthly' | 'annual'
status                  text
stripe_customer_id      text UNIQUE
stripe_subscription_id  text UNIQUE
current_period_end      timestamptz
cancel_at_period_end    boolean DEFAULT false
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

### Helper Functions (Section 5)

**`get_descendant_folders(folder_id uuid)`**
- Recursive CTE to get all descendant folder IDs
- Used for quiz generation folder filter (Section 5 Phase 6)

**`check_folder_circular_reference()`**
- Trigger function to prevent folder loops
- Validates parent_id changes don't create cycles

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

// Typing Question (formerly "short")
{
  id: string;
  type: 'typing';
  prompt: string;          // Max 180 chars
  answer: string;          // Gold standard answer
}
```

### Quiz Config Schema (JSONB in `quizzes.meta`, Section 4)

```typescript
interface QuizConfig {
  question_types: {
    mcq_count: number;      // 0-20
    typing_count: number;   // 0-20
    hybrid: boolean;        // Mix both types
  };
  coverage: 'broad' | 'focused' | 'random';
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  total_questions: number;  // 5-20
}
```

**Storage Hierarchy** (LocalStorage with fallback):
1. Per-class config (saved to localStorage per classId)
2. Standalone quiz config (saved without classId)
3. Global default (hardcoded in code)

### RLS Policies

- **All tables**: Users can only read/write rows where `user_id = auth.uid()`
- **Service role**: Used ONLY for Stripe webhook operations
- **API routes**: Use anon client + user access token (RLS auto-enforces user_id scoping)
- **Storage**: `notes-files` bucket with path prefix = `<user_id>/`

**Section 5 RLS Specifics**:
- `folders`: User can only access folders in their own classes
- `note_folders`: Mapping enforces user_id match on both note and folder
- Circular reference prevention at DB level (trigger)

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
# No OPENAI_MODEL override needed (AI Router handles model selection)
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

### Feature Flags (Section 5 + 7)
```env
# Section 5: Folder Workspace
VITE_FEATURE_WORKSPACE_FOLDERS=false  # Master toggle
VITE_FEATURE_FOLDER_DND=false         # Drag-and-drop reordering

# Section 7: Visual System
VITE_FEATURE_VISUALS=false            # Decorative frames/patterns
VITE_FEATURE_THEME_PICKER=false       # User theme selection
```

---

## Free Tier Limits

### Enforced via Live Counts
- **Max Classes**: 1 (counted via `SELECT count(*) FROM classes WHERE user_id = ...`)
- **Max Quizzes Created**: 5 (counted via `SELECT count(*) FROM quizzes WHERE user_id = ...`)

### Error Handling
- Returns `{ code: "LIMIT_EXCEEDED", message: "..." }` with 429 status
- Frontend shows upgrade CTA

---

## Implementation Status by Section

### ✅ Section 1: AI Router & Generation Analytics (Session 7)
- [x] Centralized AI router with model family detection
- [x] Automatic fallback (gpt-4o-mini → gpt-5-mini)
- [x] Dynamic parameter building (reasoning models omit temperature)
- [x] Single retry with loud warnings
- [x] Unified analytics table with JSONB data field
- [x] Quality metrics tracking (concept coverage, diversity, duplicates)
- [x] Backward compatibility view for legacy queries
- **Files**: `_lib/ai-router.ts`, `api/generate-quiz.ts`, migration

### ✅ Section 2: Grading Router & Rubric Engine (Session 8)
- [x] Length-agnostic rubric grading
- [x] Weighted scoring (coverage 40%, accuracy 35%, clarity 15%, conciseness 10%)
- [x] Model selection based on question type
- [x] Fire-and-forget grading analytics
- [x] Unified analytics integration
- **Files**: `_lib/rubric-engine.ts`, `_lib/grading-analytics.ts`, `api/grade.ts`

### ✅ Section 3: Results Page with Autosave (Session 9)
- [x] Autosave endpoint with conflict resolution
- [x] Request size limit (500KB)
- [x] Incremental autosave_version tracking
- [x] Analytics integration (results page events)
- **Files**: `api/attempts/autosave.ts`, results page components

### ✅ Section 4: Quiz Configuration System (Session 10)
- [x] Quiz config schema with Zod validation
- [x] Question types (MCQ/Typing/Hybrid)
- [x] Coverage strategies (broad/focused/random)
- [x] Difficulty levels (easy/medium/hard/adaptive)
- [x] LocalStorage persistence with hierarchy
- [x] Dynamic prompt generation based on config
- [x] Integration with generate-quiz endpoint
- **Files**: `_lib/quiz-config-schema.ts`, `_lib/prompt-builder.ts`, config UI components

### ✅ Section 5: Class Workspace with Folders (Sessions 12-13) — ALL 9 PHASES
**Phase 1-5 (Foundation)**:
- [x] Database schema (folders + note_folders tables)
- [x] Complete API layer (10 RESTful endpoints)
- [x] TypeScript types (Folder, NoteFolder, BreadcrumbSegment)
- [x] UI components (FolderTree + 3 dialogs)
- [x] Refactored ClassNotes page (two-column layout with breadcrumbs)

**Phase 6-9 (Integration & Testing)**:
- [x] Quiz generation folder filter (recursive querying)
- [x] Analytics & health metrics (10+ events, folder health endpoint)
- [x] Feature flags (VITE_FEATURE_WORKSPACE_FOLDERS + DND flag)
- [x] Testing & verification (0 TypeScript errors)

**Total**: ~5,000 lines across 21 files, production-ready

### 🚧 Section 7: Visual & Theming System (Session 11) — 60% COMPLETE
**Phase 1-3 (Foundation) ✅**:
- [x] Design token system (25 tokens, WCAG AA compliant)
- [x] Theme presets (coral-leaf-dark, ocean-dark)
- [x] CI contrast validation (`npm run check-contrast`)
- [x] Asset manifest system (brand/manifest.json)
- [x] Type-safe asset loading with retry logic
- [x] FrameWrapper component with graceful fallbacks

**Remaining**:
- [ ] Phase 4: Analytics integration (visual events)
- [ ] Phase 5: Text-only toggle (accessibility preference)

**Files**: `theme-tokens.css`, `scripts/check-contrast.ts`, `brand/manifest.json`, `lib/brand-assets.ts`, `components/FrameWrapper.tsx`

---

## Contracts & Non-Negotiables

### API Error Shape
**ALL** non-200 responses must use this exact shape:
```typescript
{ code: string, message: string }
```

**Error Codes**:
- `LIMIT_EXCEEDED` - Free tier limit hit (429)
- `SCHEMA_INVALID` - Invalid input or output (400)
- `NOT_FOUND` - Resource not found (404)
- `UNAUTHORIZED` - Missing/invalid auth (401)
- `OPENAI_ERROR` - OpenAI API failure (500)
- `SERVER_ERROR` - Internal error (500)
- `CIRCULAR_REFERENCE` - Folder loop detected (400, Section 5)

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
- ❌ **No letter field** in quiz_attempts table (compute on-demand)
- ✅ **Circular reference prevention** at DB level (Section 5 trigger)

### AI Router Patterns (Session 7)
- Reasoning models (gpt-5*, o-series): **Omit temperature parameter**
- Standard models (gpt-4o*): **Include temperature ~0.7**
- Single retry with fallback, then fail loudly
- All parameters validated before API call

### Grading Patterns (Session 8)
- Rubric weights are immutable constants
- Conciseness never penalizes (only rewards)
- MCQ answers must match exactly (no fuzzy matching)
- Typing answers use rubric-based scoring
- Fire-and-forget analytics (never blocks grading response)

---

## Feature Flags Reference

### Section 5: Folder Workspace
```typescript
const FEATURE_WORKSPACE_FOLDERS = import.meta.env.VITE_FEATURE_WORKSPACE_FOLDERS === 'true';
const FEATURE_FOLDER_DND = import.meta.env.VITE_FEATURE_FOLDER_DND === 'true';
```

**Rollback**: Set flags to `false` to revert to flat note list

### Section 7: Visual System
```typescript
const FEATURE_VISUALS = import.meta.env.VITE_FEATURE_VISUALS === 'true';
const FEATURE_THEME_PICKER = import.meta.env.VITE_FEATURE_THEME_PICKER === 'true';
```

**Rollback**: Flags default to `false`, visual elements gracefully hidden

---

## Version Timeline (Sessions 6-13)

**Session 6** (2025-11-03): Quiz generation fully working, ready for alpha testing
**Session 7** (2025-11-07): Section 1 complete — AI Router with automatic fallback + generation analytics
**Session 8** (2025-11-08): Section 2 complete — Length-agnostic rubric grading + unified analytics
**Session 9** (2025-11-09): Section 3 complete — Results page with autosave + conflict resolution
**Session 10** (2025-11-09): Section 4 complete — Quiz configuration system with dynamic prompts
**Session 11** (2025-11-10): Section 7 foundation (60%) — Design tokens + asset management
**Sessions 12-13** (2025-11-10): Section 5 complete (all 9 phases) — Folder workspace system

---

## Git & Deployment

### Current Branch
**Name**: `sections`
**Status**: All work committed, 1 commit ahead of origin
**Latest Commit**: Security patch for folder RPC vulnerability

### Build Status
- ✅ TypeScript: 0 errors for Sections 1-5 code
- ⚠️ TypeScript: 12 errors in legacy/deprecated files (non-blocking)
- ✅ WCAG AA: All 17 token pairs passing ≥4.5:1 contrast ratio
- ✅ CI Validation: `npm run check-contrast` returns 0 errors

---

## Documentation Structure

### Primary Context (Active)
- **This file** — Current source of truth for all completed sections
- `ARCHITECTURE.md` — System design reference
- `QUICK_START.md` — 2-minute onboarding for new sessions
- `Claude_Prompt_v6.md` — Development constraints and patterns
- `README.md` — Navigation guide

### Session Documentation (Complete)
- `SESSION_9_SECTION3_COMPLETE.md` — Results page + autosave
- `SESSION_10_SECTION4_COMPLETE.md` — Quiz configuration
- `SESSION_11_SECTION7_FOUNDATION.md` — Visual system foundation
- `SESSION_12-13_SECTION5_ALL_PHASES_COMPLETE.md` — Folder workspace
- `UNIFICATION_COMPLETE.md` — Analytics architecture migration
- `SECTION5_TIGHTEN_UP_COMPLETE.md` — Security patches

### Historical (Archive)
- Sessions 1-8 handoffs and reconciliation docs → See `ChatGPA_History_Archive.md`
- Old context versions (v1-v4) → `archive/context/`

---

## Key Metrics (Current State)

### Code
- **API Routes**: 23 total (2 core + 10 folders + 2 quiz + 2 grading + 2 analytics + 2 stripe + 3 helpers)
- **Frontend Pages**: 6 active (landing, dashboard, generate, quiz, results, class-notes)
- **Shared Utilities**: 7 (_lib/ai-router, rubric-engine, grading-analytics, quiz-config-schema, prompt-builder, validation, usage)
- **Components**: 15+ (FolderTree, dialogs, FrameWrapper, Toast, layouts, etc.)
- **Database Tables**: 9 core + 1 analytics + 1 subscriptions + 1 usage_limits
- **Migrations**: 4 major (analytics unification, folders, visual tokens metadata, folder health)

### Documentation
- **Context Files**: 5 versions (v1-v5)
- **Session Docs**: 13 sessions
- **Lines of Documentation**: ~8,000+ lines across all docs

---

## Next Session Focus

### Immediate Priorities
1. **Fix TypeScript errors** in legacy files (non-blocking but should be cleaned)
2. **Complete Section 7** (Phases 4-5: Analytics + Text-only toggle)
3. **Integration testing** for Sections 1-5
4. **Push security patches** to remote

### Future Work
- Section 6: Study tools sidebar (spaced repetition, flashcards)
- Performance optimization (bundle size, lazy loading)
- E2E testing (Playwright/Cypress)
- Beta user feedback integration

---

## Rules of Truth

1. **This file is the current source of truth** for app scope, architecture, and status.
2. If any document conflicts with this file, **this file wins**.
3. **Session documentation** provides detailed implementation context.
4. **Code is the ultimate truth** — if docs and code disagree, investigate and update docs.
5. **Feature flags** control rollout — all new features default to OFF.

---

**Last Updated**: 2025-11-11 (Session 14 - Doc Cleanup)
**Next Review**: After Section 7 completion or new section start
**Status**: Production-ready (Sections 1-5 complete, Section 7 at 60%)
**Build Status**: ✅ Passing for all active code

