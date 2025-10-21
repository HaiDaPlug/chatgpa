> ⚠️ **SUPERSEDED — This document is no longer current.**  
> See [`/docs/context_v2.1.md`](../context_v2.1.md) for the canonical ChatGPA specification.

# ChatGPA Infrastructure Reuse Guide

This document outlines what we're keeping from the Carpool codebase and what we're replacing.

## ✅ KEEP & REUSE (No Changes Needed)

### Authentication & User Management
- **Supabase Auth** - Magic link email authentication already working
- **User profiles table** - Can extend with ChatGPA-specific fields
- **RLS policies** - Row-level security patterns are solid

**Files:**
- `web/src/lib/supabase.ts` - Supabase client setup
- Auth hooks in `web/src/hooks/` if they exist

### Payment Infrastructure
- **Stripe integration** - checkout + webhooks already built
- **Subscription tiers** - Just rename/reprice from Cruiser/Power/Pro
- **Webhook handling** - Core pattern is solid

**Files:**
- `web/api/create-checkout-session.ts`
- `web/api/stripe-webhook.ts`
- Stripe types from Carpool

**Action:** Update tier names and prices:
- Cruiser → Free tier (modify to usage limits, not payment)
- Power → Cram Pass ($12 one-time, 7 days)
- Pro → Monthly ($9) / Annual ($79)

### Database Patterns
- **Migration system** - Keep numbered SQL files in `/supabase/migrations/`
- **RLS policies** - User can only see their own data
- **Supabase client setup** - Browser, server, admin patterns

**Keep:**
- All migration files as history
- RLS policy patterns
- View patterns for computed data

### UI Foundation
- **Tailwind config** - Dark stone + coral color scheme works for ChatGPA
- **Layout patterns** - Header, nav, responsive grid
- **Component structure** - TierCard can become ClassCard, QuizCard, etc.

**Files to adapt:**
- `web/src/components/TierCard.tsx` → pricing cards
- Landing page structure (but rewrite copy)
- Color scheme (`stone-900`, `stone-700`, coral accents)

### Build System
- **Vite + React + TypeScript** - Keep as-is
- **Vercel deployment** - Serverless functions work great
- **pnpm workspace** - Keep monorepo structure

---

## 🔄 MODIFY (Adapt for ChatGPA)

### Database Schema
**Current (Carpool):**
- `subscriptions` - tier, status, stripe IDs
- `token_ledger` - personal, reserve, pool tokens
- `usage_events` - token tracking
- `community_pool` - shared token pot

**New (ChatGPA):**
- Keep `subscriptions` (rename tiers)
- **Replace token system with:**
  - `classes` - user's courses
  - `notes` - uploaded note content + metadata
  - `quizzes` - generated quizzes
  - `quiz_attempts` - user answers + grading results
  - `usage_limits` - free tier limits (5 quizzes, 1 class)

**Action:** Create new migration `20251021_chatgpa_init.sql`

### API Routes
**Current (Carpool):**
- `/api/chat.ts` - GPT streaming
- `/api/router.ts` - action-based routing
- `/api/use-tokens.ts` - token deduction

**New (ChatGPA):**
- `/api/summarize.ts` - Claude API for note summaries
- `/api/generate-quiz.ts` - Claude API for quiz generation
- `/api/grade.ts` - Claude API for adaptive grading
- Keep `/api/router.ts` pattern but add new actions
- **Remove:** token tracking logic

### Landing Page
**Current:** Carpool AI fuel metaphor, chat preview

**New:** ChatGPA exam prep messaging
- Hero: "Exam in 3 days? Upload notes → Get quizzes → Pass with confidence"
- Features: Note upload, adaptive grading, study dashboard
- Social proof: Student testimonials
- Pricing: Free, Cram Pass, Monthly, Annual

**File:** `web/src/pages/Landing.tsx` - Complete rewrite

### Environment Variables
**Add to `.env.example`:**
```bash
# Existing from Carpool
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# New for ChatGPA
ANTHROPIC_API_KEY=               # Claude API for summaries/quizzes/grading
VITE_MAX_FREE_QUIZZES=5          # Free tier limit
VITE_MAX_FREE_CLASSES=1          # Free tier limit
```

---

## ❌ REMOVE (Not Needed)

### Token/Fuel System
- `token_ledger` table
- `community_pool` table
- `usage_events` (replace with quiz attempt tracking)
- `spend_tokens()` RPC
- `apply_monthly_allocation()` RPC
- `monthly_rollover()` RPC
- FuelMeter component
- useLedger hook
- useAccount hook (related to fuel)

### Carpool-Specific UI
- ChatPreview component (unless we want an interactive demo)
- Fuel gauge animations
- "Carpool AI" branding
- All Carpool marketing copy

---

## 📋 Migration Checklist

### Phase 1: Database
- [ ] Create `20251021_chatgpa_init.sql` with new tables
- [ ] Update subscription tiers (free/cram/monthly/annual)
- [ ] Remove token-related tables (keep old migrations for history)
- [ ] Set up Supabase Storage bucket for note uploads (PDFs, DOCX)

### Phase 2: API Routes
- [ ] Create `/api/summarize.ts` (Claude API)
- [ ] Create `/api/generate-quiz.ts` (Claude API)
- [ ] Create `/api/grade.ts` (Claude API - THE DIFFERENTIATOR)
- [ ] Update `/api/router.ts` with new actions
- [ ] Modify Stripe checkout for new tiers

### Phase 3: Frontend
- [ ] Rewrite `Landing.tsx` for ChatGPA messaging
- [ ] Create `Dashboard.tsx` (classes + quizzes)
- [ ] Create `UploadNotes.tsx` (text paste + file upload)
- [ ] Create `Quiz.tsx` (question display + answer input)
- [ ] Create `Results.tsx` (adaptive grading display)
- [ ] Update pricing cards

### Phase 4: Cleanup
- [ ] Remove unused Carpool components
- [ ] Update favicon + branding
- [ ] Clean up old planning docs (move to `/archive/`)

---

## 🎯 What Makes This Fast

**Reusing ~70% of infrastructure:**
- ✅ Auth system (100% reuse)
- ✅ Payment system (90% reuse - just update tiers)
- ✅ Database patterns (RLS, migrations, views)
- ✅ API structure (serverless functions, router pattern)
- ✅ Build/deploy pipeline (Vercel + Vite)
- ✅ UI foundation (Tailwind, component patterns)

**What we're building from scratch:**
- ChatGPA database tables (classes, notes, quizzes, attempts)
- Claude API integration (3 routes)
- Quiz UI + grading display
- Note upload functionality
- Dashboard for class organization

**Estimated time savings:** 1-2 weeks vs. starting from zero

---

## 🚀 Next Steps

1. **Create ChatGPA database schema** - `supabase/migrations/20251021_chatgpa_init.sql`
2. **Set up Anthropic API key** - Add to `.env.local`
3. **Build first API route** - `/api/summarize.ts` to prove Claude integration
4. **Update Landing page** - ChatGPA messaging
5. **Ship MVP** - 1-2 weeks timeline intact!
