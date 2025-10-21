# 🧭 ChatGPA Context v3 (Post-Migration Final)

**Date**: 2025-10-21
**Status**: ✅ Database migrated and production-ready

---

## 🎯 Mission

ChatGPA turns messy student notes into organized, adaptive study sessions.

**MVP Flow**: upload notes → summarize → auto-quiz → adaptive grading → results

---

## 💻 Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| **Frontend** | Vite + React + TypeScript + Tailwind | Uses vite.config.ts, React Router |
| **Backend** | Vercel Functions | /api/*.ts endpoints (no Next.js App Router) |
| **Database / Auth / Storage** | Supabase (Postgres + Auth + Storage) | RLS: user_id = auth.uid() |
| **Payments** | Stripe | Monthly ($9) and Annual ($79) |
| **AI** | Claude or GPT-5 | /api/summarize, /api/generate-quiz, /api/grade |

---

## 💰 Pricing / Tiers

| Tier | Price | Limits | Description |
|------|-------|--------|-------------|
| **Free** | $0 | 1 class + 5 quizzes | Basic grading |
| **Monthly Pro** | $9/month | Unlimited | Advanced adaptive grading |
| **Annual Pro** | $79/year | Unlimited | Save $29/year |

**Database Enum**:
```sql
tier AS ENUM ('free', 'monthly', 'annual')
```

---

## 🗂 Database Schema

### Tables

```sql
-- User's study subjects
classes (
  id uuid PK,
  user_id uuid FK → auth.users,
  name text,
  created_at timestamptz
)

-- Uploaded study materials
notes (
  id uuid PK,
  user_id uuid FK → auth.users,
  class_id uuid FK → classes,
  title text,
  source_type text ('text'|'pdf'|'docx'|'image'),
  path text,      -- storage path for uploads
  raw_text text,  -- pasted text content
  created_at timestamptz
)

-- Quiz sessions (questions embedded as jsonb)
quizzes (
  id uuid PK,
  user_id uuid FK → auth.users,
  class_id uuid FK → classes,
  notes_id uuid FK → notes,
  questions jsonb DEFAULT '[]',  -- Array of question objects
  meta jsonb,
  created_at timestamptz
)

-- User answers + adaptive grading results
quiz_attempts (
  id uuid PK,
  quiz_id uuid FK → quizzes,
  user_id uuid FK → auth.users,
  responses jsonb,  -- {questionId: userAnswer}
  grading jsonb,    -- {questionId: {score, got, missed, next_hint}}
  score numeric CHECK (0..1),
  created_at timestamptz
)

-- Subscription tracking (Stripe)
subscriptions (
  user_id uuid PK FK → auth.users,
  tier tier DEFAULT 'free',
  status text DEFAULT 'inactive',  -- 'active'|'inactive'|'past_due'|'canceled'
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  created_at timestamptz,
  updated_at timestamptz  -- auto-trigger
)

-- Free tier enforcement
usage_limits (
  user_id uuid PK FK → auth.users,
  classes_created int DEFAULT 0,
  quizzes_created int DEFAULT 0,  -- renamed from quizzes_taken
  updated_at timestamptz  -- auto-trigger
)
```

### Question Object Schema (in quizzes.questions jsonb)

```typescript
{
  id: string,
  kind: 'mcq' | 'short',
  prompt: string,
  options?: string[],  // for MCQ
  answer: any  // canonical answer (normalized from answer_key)
}
```

---

## 🔐 RLS Policies

| Table | Policy |
|-------|--------|
| classes, notes, quizzes, quiz_attempts | User can manage own rows (user_id = auth.uid()) |
| subscriptions | User read own, service_role manage all |
| usage_limits | User read own, service_role manage all |
| storage.objects (notes-files) | User can manage own files (path prefix = user_id) |

---

## 🧱 Migrations (Final State)

```
supabase/migrations/
├── 20251021_chatgpa_squash.sql      ✅ Base schema (all tables, RLS, triggers)
└── 20251022_squash_patch_v2.sql     ✅ Storage, column rename, status default

supabase/migrations_archive/
└── [5 old migrations archived]
```

**Applied Successfully**: Both migrations pushed to remote database.

---

## 🪣 Storage

**Bucket**: `notes-files` (private)

**Path Format**: `<user_id>/<uuid>-<filename>`

**Policies**:
- authenticated users can read/write/update/delete own files only
- checked via `(storage.foldername(name))[1] = auth.uid()::text`

---

## ⚙️ Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://iudvahqmvsmjqisxqaev.supabase.co
VITE_SUPABASE_ANON_KEY=<from-dashboard>
SUPABASE_SERVICE_KEY=<from-dashboard>

# Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...

# AI
ANTHROPIC_API_KEY=<claude-key>
# OR
OPENAI_API_KEY=<gpt-key>

# App
VITE_APP_NAME=ChatGPA
```

---

## 🧠 API Routes (Vercel Functions)

| Route | Purpose | Auth |
|-------|---------|------|
| `/api/summarize` | Generate summary from notes | Required |
| `/api/generate-quiz` | Create 8-10 quiz questions | Required |
| `/api/grade` | Adaptive grading + feedback | Required |
| `/api/stripe/checkout` | Create Stripe checkout session | Required |
| `/api/stripe/webhook` | Handle Stripe events (update subscriptions) | Webhook signature |

**Auth Method**: Supabase `createServerClient` with cookie handling (no JWT headers)

---

## 🧩 Key Schema Changes from v2

### ✅ Applied in Squash Migration
- Removed separate `questions` table → embedded in `quizzes.questions` jsonb
- Removed `entitlements` table → replaced with `subscriptions`
- Added `subscriptions.status` default `'inactive'`
- Added `usage_limits.quizzes_created` (renamed from `quizzes_taken`)

### ✅ Applied in Patch v2
- Created `notes-files` storage bucket
- Added storage RLS policies (4 policies: read/write/update/delete)
- Normalized JSON: `answer_key` → `answer` in questions
- Set `subscriptions.status` default to `'inactive'` (webhook sets `'active'`)

---

## 🚀 Next Steps for Development

### 1. Generate TypeScript Types
```bash
supabase gen types typescript --linked > web/src/types/supabase.ts
```

### 2. Test Auth Flow
```bash
cd web && pnpm dev
```
- Sign up with email
- Create a class
- Upload note (text paste or file)
- Generate quiz
- Take quiz attempt
- View adaptive grading feedback

### 3. Implement Free Tier Guards
```typescript
// Check if user can create class
const { data: limits } = await supabase
  .from('usage_limits')
  .select('classes_created')
  .eq('user_id', userId)
  .single();

const { data: subscription } = await supabase
  .from('subscriptions')
  .select('tier')
  .eq('user_id', userId)
  .single();

if (subscription?.tier === 'free' && limits?.classes_created >= 1) {
  // Show upgrade prompt
}
```

### 4. Wire AI Routes
- `/api/summarize` - Call Claude/GPT with notes.raw_text
- `/api/generate-quiz` - Generate questions array, insert into quizzes.questions
- `/api/grade` - Adaptive grading logic, update quiz_attempts

---

## 🔍 Troubleshooting

### If types are stale
```bash
supabase gen types typescript --linked > web/src/types/supabase.ts
```

### If storage upload fails
Check:
- Bucket `notes-files` exists in Supabase Dashboard
- Path format: `${userId}/filename`
- User is authenticated

### If subscription not updating
- Verify Stripe webhook secret is correct
- Check `/api/stripe/webhook` logs
- Ensure webhook is configured in Stripe Dashboard

---

## 📊 Schema Alignment Summary

| Feature | context_v2 | ✅ v3 (Current) |
|---------|------------|-----------------|
| Pricing tiers | 'free','monthly','annual' | ✅ |
| Billing table | subscriptions | ✅ |
| Questions storage | quizzes.questions jsonb | ✅ |
| Free tier tracking | usage_limits | ✅ |
| Storage bucket | notes-files | ✅ |
| Column naming | quizzes_taken | ✅ quizzes_created |
| Default status | active | ✅ inactive |

---

## ✅ Status

- ✅ Database schema finalized and migrated
- ✅ Storage bucket configured with RLS
- ✅ All migrations applied successfully
- ✅ Aligned to ChatGPA MVP requirements
- ✅ Ready for frontend development

**Last Updated**: 2025-10-21 after successful migration push
