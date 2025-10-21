> ⚠️ **SUPERSEDED — This document is no longer current.**  
> See [`/docs/context_v2.1.md`](../context_v2.1.md) for the canonical ChatGPA specification.

# ChatGPA MVP - Locked Decisions

**Last Updated:** 2025-10-21
**Status:** 🔒 LOCKED - Any deviation requires PR with 2-3 sentence rationale

---

## 🎯 Core Decisions

### Pricing (LOCKED)
- **Free tier:** 1 class, 5 quizzes total
- **Pro tier:** $9/month, unlimited
- **NO** Cram Pass ($12)
- **NO** Annual ($79)

**Rationale:** Simplicity. Two tiers = easier to explain, easier to build, faster to ship.

---

### Tech Stack (LOCKED)

**Framework:**
- Next.js App Router (NOT Vite + React Router)
- Vercel deployment
- TypeScript + Tailwind CSS

**Why Next.js App Router:**
- Server-side auth with cookies (more secure than client-side JWT)
- API routes colocated with app code
- Built-in streaming, caching, and ISR
- Consistent with modern Next.js patterns

**Structure:**
```
web/
├── app/
│   ├── api/
│   │   ├── summarize/route.ts
│   │   ├── generate-quiz/route.ts
│   │   ├── grade/route.ts
│   │   ├── upload-note/route.ts
│   │   └── stripe/
│   │       ├── checkout/route.ts
│   │       └── webhook/route.ts
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/page.tsx
│   ├── class/[id]/page.tsx
│   ├── quiz/[id]/page.tsx
│   └── layout.tsx
└── lib/
    ├── supabase/
    │   ├── server.ts          # createServerClient
    │   ├── client.ts          # createBrowserClient
    │   └── admin.ts           # service role client
    └── llm/
        └── adapter.ts         # Swappable LLM provider
```

---

### Authentication (LOCKED)

**Server-side (API routes, RSC):**
```typescript
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... rest of handler
}
```

**Client-side (components):**
```typescript
import { createBrowserClient } from '@/lib/supabase/client'

const supabase = createBrowserClient()
const { data: { user } } = await supabase.auth.getUser()
```

**NO Authorization header flow** - Cookies only, handled by Supabase middleware

---

### Database Schema (LOCKED)

**Tables:**
```sql
-- Core entities
classes          (id, user_id, name, description, created_at)
notes            (id, class_id, user_id, title, content, file_url, created_at)
quizzes          (id, class_id, user_id, note_id, title, created_at)
questions        (id, quiz_id, question, type, options, correct_answer, order)
quiz_attempts    (id, quiz_id, user_id, answers, grading_results, score, completed_at)

-- Billing
entitlements     (user_id PK, plan, stripe_customer_id, stripe_subscription_id,
                  subscription_status, current_period_end)
```

**Free tier enforcement:**
```typescript
// No usage_limits table
// Count rows directly:

async function canCreateClass(userId: string): Promise<boolean> {
  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('plan')
    .eq('user_id', userId)
    .single()

  if (entitlement?.plan === 'pro') return true

  const { count } = await supabase
    .from('classes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return (count ?? 0) < 1  // Free tier: 1 class max
}

async function canTakeQuiz(userId: string): Promise<boolean> {
  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('plan')
    .eq('user_id', userId)
    .single()

  if (entitlement?.plan === 'pro') return true

  const { count } = await supabase
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  return (count ?? 0) < 5  // Free tier: 5 quizzes total
}
```

---

### Storage (LOCKED)

**Bucket name:** `notes-files`

**Path structure:** `{user_id}/{uuid}-{filename}`

**Example:** `550e8400-e29b-41d4-a716-446655440000/abc123-chapter5.pdf`

**RLS Policies:**
```sql
-- Upload: user can upload to their own folder
create policy "users_upload_notes" on storage.objects
  for insert with check (
    bucket_id = 'notes-files' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: user can read their own files
create policy "users_read_own_notes" on storage.objects
  for select using (
    bucket_id = 'notes-files' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: user can delete their own files
create policy "users_delete_own_notes" on storage.objects
  for delete using (
    bucket_id = 'notes-files' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

### API Routes (LOCKED)

**Structure:** Dedicated endpoints, NO `router.ts` action bus

**Endpoints:**
- `POST /api/summarize` - Generate note summary
- `POST /api/generate-quiz` - Create quiz from notes
- `POST /api/grade` - Adaptive grading
- `POST /api/upload-note` - File upload + text extraction
- `POST /api/stripe/checkout` - Create Stripe session
- `POST /api/stripe/webhook` - Handle Stripe events

**NO:**
- ❌ `/api/router?action=...` monolith
- ❌ Action-based routing
- ❌ Mixed concerns in one file

---

### Stripe Integration (LOCKED)

**Products:**
- ONE product: "ChatGPA Pro" - $9/month recurring

**Environment variables:**
```bash
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_PRICE_PRO_TEST=price_test_...      # $9/mo
STRIPE_PRICE_PRO_LIVE=price_live_...      # $9/mo
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Webhook events (ONLY these):**
```typescript
// /app/api/stripe/webhook/route.ts

switch (event.type) {
  case 'checkout.session.completed':
    // Set entitlements.plan = 'pro'
    // Set stripe_customer_id, stripe_subscription_id
    break

  case 'customer.subscription.updated':
    // Update entitlements.subscription_status
    // Update current_period_end
    break

  case 'customer.subscription.deleted':
    // Set entitlements.plan = 'free'
    // Keep stripe IDs for history
    break

  case 'invoice.payment_succeeded':
    // Extend current_period_end
    break

  case 'invoice.payment_failed':
    // Set subscription_status = 'past_due'
    break
}
```

**NO handling for:**
- ❌ Cram Pass (one-time payment)
- ❌ Annual pricing
- ❌ Multiple tiers

---

### LLM Provider (LOCKED Pattern)

**Abstraction:** All LLM calls go through `lib/llm/adapter.ts`

**Interface:**
```typescript
// lib/llm/adapter.ts

export interface LLMProvider {
  summarize(content: string, context?: string): Promise<string>
  generateQuiz(content: string, numQuestions: number): Promise<Question[]>
  grade(question: Question, userAnswer: string): Promise<GradingResult>
}

// Default: Claude 3.5 Sonnet
class AnthropicProvider implements LLMProvider {
  async summarize(content: string) {
    // Claude API call
  }

  async generateQuiz(content: string, numQuestions: number) {
    // Claude API call
  }

  async grade(question: Question, userAnswer: string) {
    // Claude API call
  }
}

// Future: OpenAI provider (just swap the implementation)
class OpenAIProvider implements LLMProvider {
  // ... same interface, different implementation
}

// Export singleton
export const llm: LLMProvider = new AnthropicProvider()
```

**Usage in routes:**
```typescript
import { llm } from '@/lib/llm/adapter'

export async function POST(request: Request) {
  const { content } = await request.json()
  const summary = await llm.summarize(content)  // ✅ Provider-agnostic
  return Response.json({ summary })
}
```

**Why:**
- Swap providers without touching route code
- Test with mock LLM easily
- Compare Claude vs OpenAI performance later

---

## 🚫 Prohibited Patterns

These are explicitly NOT allowed without a PR + rationale:

1. **Multiple pricing tiers** (Cram Pass, Annual, Team, etc.)
2. **Vite + React Router** (use Next.js App Router)
3. **Authorization header auth** (use server-side cookies)
4. **`usage_limits` table** (count rows directly)
5. **`router.ts` action bus** (use dedicated endpoints)
6. **Hardcoded LLM provider** (use `llm` adapter)
7. **Client-side auth checks** (use server components + middleware)
8. **Mixed storage bucket names** (use `notes-files` only)

---

## 📝 PR Process for Deviations

If you want to deviate from these locked decisions:

1. **Create a GitHub issue** with:
   - What you want to change
   - Why (2-3 sentences)
   - Impact assessment (migration needed? breaking change?)

2. **Get approval** from co-founder

3. **Update this doc** as part of the PR

**Example PR:**
```markdown
Title: Add Team tier ($29/mo for 5 users)

Rationale: 3 beta users asked for team accounts. Team tier =
5x revenue per customer. Low implementation cost (just add
team_members table + RLS policies).

Impact: New Stripe product, new entitlements.plan value,
new RLS policies. No breaking changes to existing free/pro users.
```

---

## ✅ Current Status

**Locked decisions:** ✅ All decisions documented
**Database schema:** ⏳ Needs update (remove usage_limits, add questions table)
**API routes:** ⏳ Need to create Next.js App Router structure
**LLM adapter:** ⏳ Need to create
**Documentation:** ⏳ Needs cleanup (remove old Vite/Cram/Annual references)

---

## 🎯 Next Steps

1. **Update database migration** - Remove `usage_limits`, add `questions` table, update `entitlements`
2. **Create Next.js App Router structure** - Convert from Vite to Next.js
3. **Create `lib/llm/adapter.ts`** - Abstract LLM provider
4. **Create Supabase server/client helpers** - Cookie-based auth
5. **Clean up old docs** - Remove Vite, Cram Pass, Annual, router.ts references
6. **Build first API route** - `/api/summarize` using new patterns

---

## 📚 Reference Implementation

**File to create:**
```
web/
├── app/
│   ├── api/
│   │   ├── summarize/route.ts          ← START HERE
│   │   ├── generate-quiz/route.ts
│   │   ├── grade/route.ts
│   │   └── upload-note/route.ts
│   ├── page.tsx                         (landing)
│   ├── dashboard/page.tsx
│   └── layout.tsx
├── lib/
│   ├── llm/
│   │   └── adapter.ts                   ← CREATE THIS FIRST
│   └── supabase/
│       ├── server.ts                    ← Cookie-based server client
│       └── client.ts                    ← Browser client
└── middleware.ts                        (Supabase auth refresh)
```

---

## 🔒 Locked

This document represents the locked architecture for ChatGPA MVP.

**Any deviation requires:**
- GitHub issue with rationale
- Co-founder approval
- Update to this document

**Last locked:** 2025-10-21
**Locked by:** Co-founders
