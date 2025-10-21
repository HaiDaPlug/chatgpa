# ChatGPA

**"Turn your messy notes into a study session that actually works."**

## Overview

ChatGPA is an AI-powered study system that helps college students prepare for exams faster.  
Upload notes → Get concise summaries → Auto-generate quizzes → Receive adaptive grading feedback.

### Core Features (MVP)
- **Note Upload** – Supports text, PDF, and DOCX
- **AI Summaries** – Clean bullet-point takeaways
- **Quiz Generation** – Instant quizzes from your notes
- **Adaptive Grading** – Explains what you understood vs. what to tighten
- **Dashboard** – Organize by class, track quiz history
- **Stripe Payments** – Free tier + Monthly ($9) + Annual ($79)

---

### Tech Stack
- **Frontend:** React + Vite + TypeScript + Tailwind  
- **Backend:** Vercel Functions (`/api/*.ts`)  
- **Database:** Supabase (Postgres + Auth + Storage)  
- **Payments:** Stripe (Monthly + Annual)  
- **AI:** Claude / GPT-5 via `/api/summarize`, `/api/generate-quiz`, `/api/grade`

---

## Project Structure

```
chatgpa/
├── supabase/
│   ├── migrations/           # Canonical ChatGPA schema
│   ├── migrations_archive/   # Legacy Carpool migrations (reference only)
│   └── seed/                 # Demo data
├── web/
│   ├── api/                  # Vercel functions
│   │   ├── summarize.ts
│   │   ├── generate-quiz.ts
│   │   ├── grade.ts
│   │   └── stripe/
│   │       ├── checkout.ts
│   │       └── webhook.ts
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   └── types/
│   └── public/
└── docs/
    ├── context_v2.1.md       # Canonical spec
    └── archive/              # Superseded docs
```

---

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables**
   ```bash
   cp web/.env.example web/.env.local
   # Fill in your Supabase, Stripe, and AI keys
   ```

3. **Run migrations**
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   > Only files in `/supabase/migrations/` are active.  
   > Old Carpool migrations live in `/supabase/migrations_archive/` for reference.

4. **Start the dev server**
   ```bash
   cd web
   pnpm dev
   ```

---

## Documentation

- [`/docs/context_v2.1.md`](./docs/context_v2.1.md) – **Source of truth** (stack + schema + pricing + API)  
- `chatgpa_mvp.txt` – Core feature notes  
- `chatgpa-future-roadmap.txt` – Later-phase ideas  
- `practical_steps.md` – Implementation checklist  

---

### Reused from Carpool
- Supabase Auth (magic-link sign-in)  
- Stripe integration boilerplate  
- Base UI theme (dark stone + coral)  
- Migration & RLS patterns  

---

> **Rule:** If a doc or file conflicts with `context_v2.1.md`, the context file wins.  
> Outdated materials belong in `/docs/archive/` with a **SUPERSEDED** banner.