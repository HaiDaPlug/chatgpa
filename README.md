# ChatGPA

**"Turn your messy notes into a study session that actually works."**

A world-class quiz generator that helps procrastinators and overwhelmed students start studying immediately — with zero friction and instant adaptive feedback.

[![Status](https://img.shields.io/badge/status-production-success)]()
[![Build](https://img.shields.io/badge/build-passing-success)]()
[![Docs](https://img.shields.io/badge/docs-modular-blue)](./docs/core/ChatGPA_Spec_Hub.md)

---

## Overview

**ChatGPA v1.12 Mission**: Become the smartest, cleanest, most reliable quiz generator for students — a tool that turns messy notes into adaptive quizzes and clear feedback in seconds.

Not an Academic OS. Not a workspace. Not a calendar app. Just a **world-class quiz engine** + clean academic UI.

### The Core Promise

Students open ChatGPA → paste notes → get a polished quiz in **<10 seconds**.

**The Irresistible Loop**: Notes → Quiz → Feedback → Try Again → Progress Overview

This loop is the product. Everything else (summaries, flashcards, scheduling) comes later as "study tools" beside quiz generation.

### What Makes This the Best Quiz Generator

1. **Zero-Friction Studying** — No setup, no cognitive tax. Paste notes → quiz in 10 seconds.

2. **Adaptive Feedback That Actually Teaches** — Every question gets immediate, context-aware feedback. Results show mistake patterns, mastery indicators, and actionable insights.

3. **Calm, Professional Academic Environment** — "Claude × Notion" aesthetic. Minimal, structured, serious-friendly. Not playful or loud.

4. **Reliability > Everything** — No hallucinations. Correct JSON. RLS-safe. Stable quiz generation, grading, and UI state.

5. **Smart AI Integration** — Automatic model fallback (gpt-4o-mini → gpt-5-mini). Length-agnostic rubric grading (not keyword matching).

### North Star Metric

**Daily quizzes started.**

Not notes uploaded. Not classes created. Not time in the dashboard.

It's all about engagement with the quiz loop.

### Status (December 2025 - v1.12 Pivot)

- 🎯 **Mission**: World-class quiz generator (not Academic OS)
- ✅ **Core Loop Working**: Notes → Quiz → Feedback → Results (production-ready)
- ✅ **0 TypeScript Errors**: Clean build
- ✅ **23 API Endpoints**: AI generation, grading, attempts, billing
- ✅ **Solid Infrastructure**: RLS-enforced database, OpenAI integration, auth system
- 🔄 **In Progress**: Simplifying UX to remove friction, focusing on quiz-first experience

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vite + React 18 + TypeScript + Tailwind CSS |
| **Backend** | Vercel Serverless Functions (Node.js ESM) |
| **Database** | Supabase (PostgreSQL + Auth + Storage + RLS) |
| **AI** | OpenAI (gpt-4o-mini, gpt-5-mini) |
| **Payments** | Stripe (Monthly $9, Annual $79) |
| **Validation** | Zod schemas |
| **Motion** | Framer Motion |

---

## Quick Start

### Prerequisites

- Node.js 18+ (with pnpm)
- Supabase account & project
- OpenAI API key
- Stripe account (test + live keys)

### 1. Clone & Install

```bash
git clone https://github.com/HaiDaPlug/chatgpa.git
cd chatgpa
pnpm install
```

### 2. Environment Setup

```bash
cp web/.env.example web/.env.local
```

Edit `web/.env.local` with your credentials:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Stripe
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY_TEST=price_...
STRIPE_PRICE_ANNUAL_TEST=price_...
APP_MODE=test  # or "live"

# App
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=ChatGPA

# Feature Flags (optional)
VITE_FEATURE_WORKSPACE_FOLDERS=false
VITE_FEATURE_VISUALS=false
```

### 3. Database Setup

```bash
# Login to Supabase CLI
npx supabase login

# Link your project
npx supabase link --project-ref your_project_ref

# Run migrations
npx supabase db push
```

### 4. Run Development Server

```bash
cd web
pnpm dev
```

App runs at `http://localhost:5173`

### 5. Run API Functions Locally

```bash
cd web
vercel dev
```

API runs at `http://localhost:3000/api/*`

---

## Repository Structure

```
chatgpa/
├── docs/
│   ├── core/                      # ⭐ Modular documentation system
│   │   ├── ChatGPA_Spec_Hub.md    # Navigation entry point
│   │   ├── CURRENT_STATE.md       # Project status snapshot
│   │   ├── Architecture.md        # System design & database
│   │   ├── API_Reference.md       # All 23 endpoints
│   │   ├── Features.md            # Sections 1-7 specifications
│   │   ├── Design_System.md       # Tokens + visuals + UX
│   │   ├── Security_Rules.md      # RLS + auth constraints
│   │   ├── ESM_Rules.md           # Node.js import requirements
│   │   └── Claude_Prompt_v7.md    # AI agent guidelines
│   └── archive/
│       ├── sessions/              # Session logs 9-16
│       └── old/                   # Superseded docs
├── web/
│   ├── api/                       # Vercel Serverless Functions
│   │   ├── v1/                    # Gateway pattern
│   │   │   ├── ai/                # Quiz generation & grading
│   │   │   ├── attempts/          # Quiz attempt management
│   │   │   ├── billing/           # Stripe checkout & portal
│   │   │   ├── marketing/         # Waitlist & feedback
│   │   │   ├── util/              # Health, ping, telemetry
│   │   │   └── workspace/         # Folder & note operations
│   │   ├── _lib/                  # Shared utilities
│   │   │   ├── ai-router.ts       # Model selection + fallback
│   │   │   ├── rubric-engine.ts   # Grading logic
│   │   │   └── ...
│   │   └── tsconfig.json          # NodeNext module resolution
│   ├── src/
│   │   ├── pages/                 # React pages
│   │   │   ├── Landing.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── GeneratePage.tsx
│   │   │   ├── QuizPage.tsx
│   │   │   ├── Results.tsx
│   │   │   └── ClassNotes.tsx
│   │   ├── components/            # Reusable components
│   │   ├── lib/                   # Frontend utilities
│   │   ├── brand/                 # Visual assets + manifest
│   │   ├── theme-tokens.css       # Design system tokens
│   │   └── types.ts
│   └── public/
├── supabase/
│   ├── migrations/                # Database schema + RLS
│   └── seed/                      # Demo data
└── README.md                      # This file
```

---

## Documentation

### Start Here

📚 **[/docs/core/ChatGPA_Spec_Hub.md](/docs/core/ChatGPA_Spec_Hub.md)** — Navigation hub for all documentation

### Core Specifications

| File | Purpose |
|------|---------|
| [CURRENT_STATE.md](/docs/core/CURRENT_STATE.md) | Current status, known issues, priorities |
| [Architecture.md](/docs/core/Architecture.md) | System design, database schema, RLS rules |
| [API_Reference.md](/docs/core/API_Reference.md) | All 23 endpoints with contracts |
| [Features.md](/docs/core/Features.md) | Product feature specifications (Sections 1-7) |
| [Design_System.md](/docs/core/Design_System.md) | Theme tokens, visual patterns, UX guidelines |
| [Security_Rules.md](/docs/core/Security_Rules.md) | RLS policies, auth constraints |
| [ESM_Rules.md](/docs/core/ESM_Rules.md) | Node.js import requirements |
| [Claude_Prompt_v7.md](/docs/core/Claude_Prompt_v7.md) | AI development guidelines |

### Quick References

- **For New Sessions**: Read `CURRENT_STATE.md` → `Architecture.md` → `Claude_Prompt_v7.md`
- **For API Work**: Read `API_Reference.md` + `Security_Rules.md` + `ESM_Rules.md`
- **For Feature Work**: Read `Features.md` + relevant section docs in archive
- **For Bugs**: Check `CURRENT_STATE.md` known issues

---

## Product Philosophy (v1.12)

### What ChatGPA IS

✅ **World-class quiz generator** — The best tool for turning notes into quizzes
✅ **Zero-friction study starter** — Helps procrastinators start studying immediately
✅ **Adaptive feedback engine** — Teaches through context-aware grading
✅ **Calm academic environment** — Professional, minimal, "Claude × Notion" aesthetic
✅ **Reliable AI tool** — No hallucinations, stable generation, predictable results

### What ChatGPA is NOT (yet)

❌ Not a Notion competitor
❌ Not a full Academic OS
❌ Not a collaborative suite
❌ Not an all-purpose AI tool
❌ Not trying to replace Google Classroom yet

### Strategic Path

1. **Perfect the quiz system first** (← we are here)
2. Build trust with students
3. Add study tools one at a time (flashcards, summaries, etc.)
4. THEN evolve into Academic OS

This narrow focus prevents death by complexity.

## Technical Features (Production-Ready)

### Core Quiz Engine
- **AI Router**: Automatic model fallback (gpt-4o-mini → gpt-5-mini)
- **Rubric Grading**: Length-agnostic scoring (coverage 40%, accuracy 35%, clarity 15%, conciseness 10%)
- **Question Types**: MCQ, typing, hybrid
- **Difficulty Levels**: Easy, medium, hard, adaptive
- **Quality Metrics**: Concept coverage, diversity, duplicate detection

### User Experience
- **One-Question-at-a-Time UI**: Focused studying with progress tracking
- **Autosave System**: Real-time answer saving with conflict resolution
- **Theme System**: 3 presets (academic-dark, midnight-focus, academic-light)
- **Instant Feedback**: Context-aware explanations for every answer
- **Progress Overview**: Mistake patterns, mastery indicators

### Infrastructure
- **23 API Endpoints**: Across 6 gateways (ai, attempts, billing, marketing, util, workspace)
- **Row-Level Security**: All database tables RLS-enforced
- **Auth System**: Email/password + Google OAuth
- **ESM Compliant**: Node.js ES Modules with proper resolution
- **Feature Flags**: Gradual rollout capability

---

## Development

### Build & Test

```bash
# Type checking
pnpm tsc --noEmit

# Build frontend
cd web
pnpm build

# Run tests (if implemented)
pnpm test

# Contrast validation
npm run check-contrast
```

### Database Migrations

```bash
# Create new migration
npx supabase migration new migration_name

# Apply migrations locally
npx supabase db reset

# Push to remote
npx supabase db push
```

### Deployment

```bash
# Deploy to Vercel
vercel --prod

# Environment variables must be set in Vercel dashboard
```

---

## Contributing

### For AI Agents (Claude)

1. Read [Claude_Prompt_v7.md](/docs/core/Claude_Prompt_v7.md)
2. Always check [CURRENT_STATE.md](/docs/core/CURRENT_STATE.md) first
3. Follow [Security_Rules.md](/docs/core/Security_Rules.md) and [ESM_Rules.md](/docs/core/ESM_Rules.md)
4. Update the correct module (no duplication across docs)

### For Human Developers

1. Read [CURRENT_STATE.md](/docs/core/CURRENT_STATE.md) for project status
2. Check [Features.md](/docs/core/Features.md) for product specs
3. Use [API_Reference.md](/docs/core/API_Reference.md) for integration work
4. Follow [Security_Rules.md](/docs/core/Security_Rules.md) strictly

---

## Architecture Highlights

### Security First

- **Row-Level Security (RLS)**: Enforced on all tables
- **Parent-Ownership Verification**: Child records verify parent resource ownership
- **No Service Role in User Endpoints**: Only anon client + user tokens
- **UUID Guessing Protected**: Can't access data by guessing UUIDs

### Gateway Pattern

All APIs follow consistent structure:

```
POST /api/v1/{gateway}?action={action_name}
Authorization: Bearer <token>
Body: { ...params }

Response: { data: { ...results } } | { code, message }
```

### ESM Compliance

All backend code follows Node.js ES Module requirements:

- All imports use `.js` extensions
- `moduleResolution: "NodeNext"` in tsconfig
- No directory imports (explicit `index.js`)
- Lazy initialization for environment-dependent code

---

## Pricing

| Tier | Price | Classes | Quizzes |
|------|-------|---------|---------|
| **Free** | $0/mo | 1 | 5 created |
| **Monthly** | $9/mo | Unlimited | Unlimited |
| **Annual** | $79/yr | Unlimited | Unlimited |

---

## License

Proprietary - All rights reserved

---

## Contact

- **Repository**: https://github.com/HaiDaPlug/chatgpa
- **Maintainer**: Hai (solo team)
- **AI Assistant**: Claude Code
- **Orchestration**: ChatGPT

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| **v1.12** | Dec 7, 2025 | 🎯 **Strategic Pivot**: World-class quiz generator focus (not Academic OS) |
| **v7.0** | Nov 29, 2025 | Quiz page refactor (one-question-at-a-time UI), modular docs |
| **v6.0** | Nov 18, 2025 | Theme System V2, navigation, all sections complete |
| **v5.0** | Nov 11, 2025 | Sections 1-5 complete, ESM compliance |
| **v4.0** | Oct 26, 2024 | Production-ready, alpha testing |
| **v3.0** | Oct 23, 2024 | Usage limits, live counts |
| **v2.0** | Oct 22, 2024 | API contracts, RLS patterns |
| **v1.0** | Oct 21, 2024 | Initial Carpool → ChatGPA migration |

---

**Last Updated**: December 7, 2025 (v1.12 - Quiz-First Pivot)
**Documentation**: [/docs/core/ChatGPA_Spec_Hub.md](/docs/core/ChatGPA_Spec_Hub.md)
**Status**: Production-Ready (Core Loop) — Pivoting to Zero-Friction UX
