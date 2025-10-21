> ⚠️ **SUPERSEDED — This document is no longer current.**  
> See [`/docs/context_v2.1.md`](../context_v2.1.md) for the canonical ChatGPA specification.

# 🔒 ChatGPA Locked Architecture - Implementation Guide

**Status:** LOCKED ✅
**Date:** 2025-10-21
**Deviation Policy:** Requires PR with 2-3 sentence rationale

---

## 📦 What's Been Created

### ✅ Core Infrastructure

1. **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Locked decisions document
2. **[supabase/migrations/20251021_chatgpa_mvp_locked.sql](./supabase/migrations/20251021_chatgpa_mvp_locked.sql)** - Database schema
3. **[web/lib/llm/adapter.ts](./web/lib/llm/adapter.ts)** - Swappable LLM provider
4. **[web/lib/supabase/server.ts](./web/lib/supabase/server.ts)** - Server-side Supabase client
5. **[web/lib/supabase/client.ts](./web/lib/supabase/client.ts)** - Browser Supabase client
6. **[web/lib/supabase/admin.ts](./web/lib/supabase/admin.ts)** - Admin client (service_role)
7. **[web/middleware.ts](./web/middleware.ts)** - Auth session refresh

---

## 🗂️ Required Next.js App Router Structure

You need to convert from the current Vite setup to Next.js App Router:

```
web/
├── app/
│   ├── api/
│   │   ├── summarize/
│   │   │   └── route.ts              ← START HERE (Week 1, Day 1-2)
│   │   ├── generate-quiz/
│   │   │   └── route.ts              ← Week 1, Day 2-3
│   │   ├── grade/
│   │   │   └── route.ts              ← Week 1, Day 3-5 (THE MOAT!)
│   │   ├── upload-note/
│   │   │   └── route.ts              ← Week 2, Day 6-7
│   │   └── stripe/
│   │       ├── checkout/
│   │       │   └── route.ts          ← Week 2, Day 10
│   │       └── webhook/
│   │           └── route.ts          ← Week 2, Day 10
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   │
│   ├── dashboard/
│   │   └── page.tsx                  ← Week 1, Day 3-4
│   │
│   ├── class/
│   │   └── [id]/
│   │       └── page.tsx              ← Week 1, Day 5
│   │
│   ├── quiz/
│   │   └── [id]/
│   │       └── page.tsx              ← Week 2, Day 6-7
│   │
│   ├── results/
│   │   └── [attemptId]/
│   │       └── page.tsx              ← Week 2, Day 8-9
│   │
│   ├── page.tsx                      (Landing page - Week 1, Day 1-2)
│   ├── layout.tsx                    (Root layout with providers)
│   └── globals.css                   (Tailwind imports)
│
├── components/
│   ├── ui/                           (shadcn/ui or custom)
│   ├── ClassCard.tsx
│   ├── QuizCard.tsx
│   ├── NoteUpload.tsx
│   └── GradingFeedback.tsx
│
├── lib/
│   ├── llm/
│   │   └── adapter.ts                ✅ DONE
│   ├── supabase/
│   │   ├── server.ts                 ✅ DONE
│   │   ├── client.ts                 ✅ DONE
│   │   └── admin.ts                  ✅ DONE
│   └── utils.ts
│
├── middleware.ts                      ✅ DONE
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 Implementation Checklist

### Phase 1: Setup (Day 0)

- [x] Create locked architecture docs
- [x] Create database schema
- [x] Create LLM adapter
- [x] Create Supabase helpers
- [ ] Run database migration in Supabase
- [ ] Update `.env.local` with all keys
- [ ] Install Next.js dependencies
- [ ] Convert Vite config to Next.js config

### Phase 2: API Routes (Week 1)

#### `/api/summarize/route.ts` (Day 1-2)

```typescript
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { llm } from '@/lib/llm/adapter'

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const { content, className } = await request.json()

    const summary = await llm.summarize(content, className)

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
}
```

#### `/api/generate-quiz/route.ts` (Day 2-3)

```typescript
import { NextResponse } from 'next/server'
import { createServerClient, requireUser } from '@/lib/supabase/server'
import { llm } from '@/lib/llm/adapter'

export async function POST(request: Request) {
  const user = await requireUser()
  const supabase = createServerClient()

  const { classId, noteId, content, numQuestions, difficulty } = await request.json()

  // Generate quiz
  const questions = await llm.generateQuiz(content, numQuestions, difficulty)

  // Store quiz in database
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      class_id: classId,
      user_id: user.id,
      note_id: noteId,
      title: `Quiz - ${new Date().toLocaleDateString()}`
    })
    .select()
    .single()

  // Store questions
  const questionInserts = questions.map((q, idx) => ({
    quiz_id: quiz.id,
    question: q.question,
    type: q.type,
    options: q.options,
    correct_answer: q.correct_answer,
    order_num: idx + 1
  }))

  await supabase.from('questions').insert(questionInserts)

  return NextResponse.json({ success: true, quizId: quiz.id })
}
```

#### `/api/grade/route.ts` (Day 3-5) - **THE MOAT**

```typescript
import { NextResponse } from 'next/server'
import { createServerClient, requireUser } from '@/lib/supabase/server'
import { llm } from '@/lib/llm/adapter'

export async function POST(request: Request) {
  const user = await requireUser()
  const supabase = createServerClient()

  const { quizId, answers } = await request.json()

  // Check free tier limits
  const { data: entitlement } = await supabase
    .from('entitlements')
    .select('plan')
    .eq('user_id', user.id)
    .single()

  if (entitlement?.plan !== 'pro') {
    const { count } = await supabase
      .from('quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Free tier limit reached. Upgrade to Pro for unlimited quizzes.' },
        { status: 403 }
      )
    }
  }

  // Fetch questions with correct answers
  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('order_num')

  // Grade each answer
  const gradingResults = await Promise.all(
    questions.map(async (q) => {
      const userAnswer = answers[q.id]
      return await llm.grade(q, userAnswer, q.correct_answer)
    })
  )

  // Calculate score
  const correctCount = gradingResults.filter(r => r.correct).length
  const score = (correctCount / questions.length) * 100

  // Store attempt
  const { data: attempt } = await supabase
    .from('quiz_attempts')
    .insert({
      quiz_id: quizId,
      user_id: user.id,
      answers,
      grading_results: gradingResults,
      score
    })
    .select()
    .single()

  return NextResponse.json({
    success: true,
    attemptId: attempt.id,
    score,
    results: gradingResults
  })
}
```

### Phase 3: Frontend Pages (Week 1-2)

Landing → Dashboard → Class Detail → Quiz → Results

---

## 📋 Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...          # For admin client

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Stripe
STRIPE_SECRET_KEY_TEST=sk_test_xxx
STRIPE_SECRET_KEY_LIVE=sk_live_xxx
STRIPE_PRICE_PRO_TEST=price_test_xxx        # $9/mo
STRIPE_PRICE_PRO_LIVE=price_live_xxx        # $9/mo
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🗄️ Database Migration Steps

1. **Log into Supabase Dashboard**
2. **Go to SQL Editor**
3. **Paste content from:** `supabase/migrations/20251021_chatgpa_mvp_locked.sql`
4. **Run migration**
5. **Verify tables created:**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('classes', 'notes', 'quizzes', 'questions', 'quiz_attempts', 'entitlements');
   ```
6. **Verify storage bucket created:**
   - Go to Storage tab
   - Check for `notes-files` bucket
   - Verify it's set to Private

---

## 🧪 Testing Strategy

### Unit Tests (for LLM adapter)

```typescript
// __tests__/llm/adapter.test.ts

import { llm } from '@/lib/llm/adapter'

describe('LLM Adapter', () => {
  it('generates summary from notes', async () => {
    const summary = await llm.summarize('Mitosis is cell division...')
    expect(summary).toContain('mitosis')
  })

  it('generates quiz questions', async () => {
    const questions = await llm.generateQuiz('Mitosis notes...', 5)
    expect(questions).toHaveLength(5)
    expect(questions[0]).toHaveProperty('id')
    expect(questions[0]).toHaveProperty('question')
  })

  it('provides adaptive grading feedback', async () => {
    const result = await llm.grade(
      { id: 'q1', question: 'What is mitosis?', type: 'short_answer', correct_answer: 'Cell division' },
      'When a cell divides',
      'Cell division producing two identical daughter cells'
    )
    expect(result.feedback).toContain('✅')
  })
})
```

### Integration Tests

```typescript
// __tests__/api/summarize.test.ts

import { POST } from '@/app/api/summarize/route'

describe('/api/summarize', () => {
  it('requires authentication', async () => {
    const request = new Request('http://localhost:3000/api/summarize', {
      method: 'POST',
      body: JSON.stringify({ content: 'test' })
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})
```

---

## 🚨 Common Issues & Solutions

### Issue: `createServerClient` not found

**Solution:** Install `@supabase/ssr` package:
```bash
pnpm add @supabase/ssr
```

### Issue: LLM returns markdown code blocks instead of JSON

**Solution:** Already handled in adapter.ts - strips ```json wrappers

### Issue: Free tier not enforced

**Solution:** Check that entitlements table has rows and counting logic is correct

### Issue: Storage upload fails

**Solution:**
1. Verify bucket `notes-files` exists
2. Check RLS policies are applied
3. Ensure path format is `{user_id}/{filename}`

---

## 📊 Implementation Timeline

| Week | Days | Tasks |
|------|------|-------|
| **Week 1** | Mon-Tue | Database migration, `/api/summarize`, Landing page rewrite |
| | Wed-Thu | `/api/generate-quiz`, Dashboard page |
| | Fri | `/api/grade` (start), Class detail page |
| **Week 2** | Mon-Tue | `/api/grade` (finish - THE MOAT!), Quiz page |
| | Wed-Thu | `/api/upload-note`, Results page |
| | Fri | Stripe integration, End-to-end testing |

---

## ✅ Definition of Done

MVP is complete when:

- [ ] All 6 API routes working
- [ ] Free tier enforced (1 class, 5 quizzes)
- [ ] Adaptive grading feels encouraging and educational
- [ ] File upload (PDF/DOCX) extracts text correctly
- [ ] Stripe checkout creates Pro subscription
- [ ] Deployed to Vercel
- [ ] 3-5 beta testers actively using it
- [ ] At least 2 beta testers say "I'd pay for this"

---

## 🔒 Locked

This architecture is **locked**. Any changes require:

1. GitHub issue with 2-3 sentence rationale
2. Co-founder approval
3. Update to [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)

**Next step:** Run database migration, then build `/api/summarize/route.ts` 🚀
