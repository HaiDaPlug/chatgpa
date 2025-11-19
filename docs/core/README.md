# ChatGPA Core Documentation

**Version:** 7.1
**Last Updated:** November 19, 2025 (Session 19)
**Status:** ✅ Production-Ready (Sections 1-7 Complete)

---

## 🚀 Quick Start

**For Claude Sessions:** Start here → Read in this order:
1. **[CURRENT_STATE.md](./CURRENT_STATE.md)** (5 min) - What works, what's broken, what's next
2. **[Architecture.md](./Architecture.md)** (15 min) - System design, data flows, RLS
3. **[Claude_Prompt_v7.md](./Claude_Prompt_v7.md)** (10 min) - Development rules & constraints
4. Reference other docs as needed for specific tasks

**For Quick Context:** [ChatGPA_Spec_Hub.md](./ChatGPA_Spec_Hub.md) - Entry point with full navigation

---

## 📚 Documentation Index

### Core Specifications (Read These)

| File | Purpose | Size | When to Read |
|------|---------|------|--------------|
| **[CURRENT_STATE.md](./CURRENT_STATE.md)** | Current status, known issues, immediate priorities | ~240 lines | **Start every session here** |
| **[Architecture.md](./Architecture.md)** | System design, data flows, RLS rules, database schema | ~600 lines | Understanding how it works |
| **[Features.md](./Features.md)** | Product specs for Sections 1-7 (complete) | ~400 lines | Product understanding |
| **[API_Reference.md](./API_Reference.md)** | All 23 endpoints with contracts & validation | ~450 lines | API integration/debugging |
| **[Design_System.md](./Design_System.md)** | Theme tokens, visual patterns, UX guidelines | ~400 lines | UI/UX development |
| **[Security_Rules.md](./Security_Rules.md)** | RLS policies, auth patterns, data constraints | ~350 lines | Security implementation |
| **[ESM_Rules.md](./ESM_Rules.md)** | Node.js ESM import rules, TypeScript config | ~250 lines | Backend development |
| **[ChatGPA_Spec_Hub.md](./ChatGPA_Spec_Hub.md)** | Documentation hub, navigation, philosophy | ~210 lines | Project overview |
| **[Claude_Prompt_v7.md](./Claude_Prompt_v7.md)** | AI agent development guidelines | ~300 lines | Claude onboarding |

### Session History

| File | Purpose | Size | Date |
|------|---------|------|------|
| **[SESSION_19.md](./SESSION_19.md)** | UI/UX overhaul, theme redesign, navigation polish | ~600 lines | Nov 19, 2025 |
| **[SESSION_18.md](./SESSION_18.md)** | Theme system V2, error UX fixes | ~480 lines | Nov 18, 2025 |
| **[Session_17_Summary.md](./Session_17_Summary.md)** | Results page error visibility, theme tokens | ~450 lines | Nov 11, 2025 |

**Older sessions (9-16):** See [/docs/archive/sessions/](../archive/sessions/)

---

## 🎯 What ChatGPA Does

ChatGPA is an **AI-powered study system** that transforms messy student notes into adaptive quizzes with context-aware grading.

**Core Flow:**
```
Upload Notes → Configure Quiz → Generate Questions → Take Quiz →
Submit Answers → Receive AI Grade + Feedback → Review Results
```

**Key Features:**
- Length-agnostic rubric grading (not keyword matching)
- Automatic AI fallback (gpt-4o-mini → gpt-5-mini)
- Folder workspace for note organization
- Usage limits with subscription tiers
- Token-based theme system with 3 presets

---

## ✅ What's Working (Latest: Session 19)

### Complete Sections (1-7)
- ✅ **Section 1:** AI Router with automatic fallback
- ✅ **Section 2:** Length-agnostic rubric grading
- ✅ **Section 3:** Results page with autosave + conflict resolution
- ✅ **Section 4:** Quiz config system (types, difficulty, coverage)
- ✅ **Section 5:** Folder workspace with 10 API endpoints
- ✅ **Section 6a:** Sidebar navigation with breadcrumbs & accessibility
- ✅ **Section 6b:** API Gateway consolidation (`/api/v1/*`)
- ✅ **Section 7:** Theme System V2 with 3 presets (academic-dark, midnight-focus, academic-light)

### Latest Updates (Session 19)
- ✅ **Landing Page:** Polished public landing at `/` with hero, benefits, pricing
- ✅ **Sign-In Flow:** Complete auth pages (`/signin`, `/signup`, `/forgot-password`)
- ✅ **Account Menu:** Sign-out with telemetry tracking
- ✅ **Theme Refinements:** Deep blue palette, improved readability
- ✅ **Navigation:** Full sidebar with collapse, keyboard nav, breadcrumbs
- ✅ **Component Library:** Minimal polished buttons, professional patterns
- ✅ **Accessibility:** Skip links, ARIA labels, keyboard navigation

### Infrastructure
- **Database:** 11 tables with RLS policies enforced
- **API Endpoints:** 23 across 6 gateways (`/api/v1/{ai,attempts,billing,marketing,util,workspace}`)
- **ESM Compliance:** All imports use `.js` extensions, NodeNext module resolution
- **Security:** Parent-ownership RLS verified, no service role abuse
- **Feature Flags:** 4 active flags for gradual rollout
- **Build Status:** ✅ Passing (0 TypeScript errors in active code)

---

## 🏗️ Tech Stack

**Frontend:**
- Vite + React 18 + TypeScript
- Tailwind CSS + Custom Theme Tokens
- React Router v6 (`<BrowserRouter>`)
- Supabase Auth + Realtime
- Framer Motion (animations)

**Backend:**
- Vercel Serverless Functions
- Node.js ESM (NodeNext resolution)
- Zod validation
- OpenAI API (gpt-4o-mini, gpt-5-mini)

**Database:**
- Supabase (PostgreSQL + Auth + Storage)
- Row-Level Security (RLS) enforced
- Migrations in `/supabase/migrations/`

**Payments:**
- Stripe (test + live modes)
- Monthly ($9/mo) + Annual ($79/yr)

---

## 📂 Repository Structure

```
chatgpa/
├── docs/
│   ├── core/                    # Modular specifications (YOU ARE HERE)
│   │   ├── README.md            # This file - navigation hub
│   │   ├── CURRENT_STATE.md     # Start here for quick context
│   │   ├── ChatGPA_Spec_Hub.md  # Documentation philosophy & links
│   │   ├── Architecture.md      # System design & data flows
│   │   ├── API_Reference.md     # All 23 endpoint contracts
│   │   ├── Features.md          # Product feature specs
│   │   ├── Design_System.md     # Theme tokens & UX patterns
│   │   ├── Security_Rules.md    # RLS policies & auth rules
│   │   ├── ESM_Rules.md         # Node.js import requirements
│   │   ├── Claude_Prompt_v7.md  # AI agent guidelines
│   │   ├── SESSION_19.md        # Latest session log
│   │   ├── SESSION_18.md        # Theme system V2
│   │   └── Session_17_Summary.md # Error visibility fixes
│   │
│   └── archive/
│       ├── sessions/            # Session logs 9-16
│       └── old/                 # Superseded context files (v1-v5)
│
├── web/
│   ├── src/                     # Frontend (React + TypeScript)
│   │   ├── pages/               # Route pages (Landing, Dashboard, Quiz, etc.)
│   │   ├── components/          # Shared components (Sidebar, Header, etc.)
│   │   ├── lib/                 # Utils, hooks, telemetry
│   │   ├── theme-tokens.css     # CSS custom properties
│   │   └── index.css            # Global styles
│   │
│   └── api/                     # Serverless functions (/api/v1/*)
│       ├── v1/                  # Versioned API gateway
│       │   ├── ai.ts            # AI operations (generate, grade)
│       │   ├── attempts.ts      # Quiz attempt CRUD
│       │   ├── billing.ts       # Stripe checkout
│       │   ├── marketing.ts     # Waitlist, feedback
│       │   ├── util.ts          # Ping, health, telemetry
│       │   └── workspace.ts     # Folder CRUD
│       └── shared/              # Shared utilities, types
│
├── supabase/
│   └── migrations/              # Database schema + RLS policies
│
└── README.md                    # Project overview + quick start
```

---

## 🎨 Theme System Overview

**Current Palette (Session 19):**

### 3 Theme Presets
1. **Academic Dark** (default) - Deep blue-grey surfaces, warm tones
2. **Midnight Focus** - True black OLED surfaces, maximum contrast
3. **Academic Light** - Soft blue-tinted whites, optimized for daylight

### Design Tokens (All Themes)
All components use semantic CSS variables:

**Surface Tokens:**
- `--bg` - Page background
- `--surface` - Card/panel background
- `--surface-raised` - Elevated cards
- `--surface-subtle` - Pressed states

**Text Tokens:**
- `--text` - Primary text (high contrast)
- `--text-muted` - Secondary text
- `--text-soft` - Tertiary text

**Interactive Tokens:**
- `--accent` - Primary interactive color
- `--accent-text` - Text on accent backgrounds
- `--accent-soft` - Subtle accent backgrounds
- `--accent-strong` - Hover/active states

**Semantic Tokens:**
- `--score-pass` - Success states (green)
- `--score-fail` - Error states (red)
- `--border-subtle`, `--border-strong` - Borders

**Motion Tokens:**
- `--motion-duration-fast` (100ms)
- `--motion-duration-normal` (180ms)
- `--motion-duration-slow` (250ms)
- `--motion-ease` - Cubic bezier curve

### Data Attributes (Theme Control)
Themes controlled via `<html>` attributes:
```html
<html
  data-theme="academic-dark"    <!-- academic-dark | midnight-focus | academic-light -->
  data-accent="study-blue"      <!-- study-blue | leaf | custom -->
  data-font="inter"             <!-- inter | system | serif -->
  data-contrast="normal"        <!-- normal | high | auto -->
  data-motion="full"            <!-- full | reduced | none -->
>
```

---

## 🔐 Security Architecture

**RLS (Row-Level Security) Enforced:**
- All tables have `user_id` column
- SELECT/INSERT/UPDATE/DELETE policies check `auth.uid()`
- No service role bypass in application code
- Parent-ownership cascade (notes inherit class ownership)

**Authentication:**
- Supabase Auth with email/password + OAuth (Google)
- Magic link for passwordless sign-in
- Session tokens stored in httpOnly cookies

**API Security:**
- All endpoints validate `Authorization: Bearer <token>`
- Zod schemas validate request bodies
- Input sanitization before database writes
- Error messages don't leak sensitive data

See [Security_Rules.md](./Security_Rules.md) for full policies.

---

## 📊 System Stats (Current)

| Metric | Count | Status |
|--------|-------|--------|
| **Sections Complete** | 7 of 7 | ✅ 100% |
| **API Endpoints** | 23 | ✅ All working |
| **Database Tables** | 11 | ✅ All with RLS |
| **Frontend Pages** | 10 | ✅ All functional |
| **Feature Flags** | 4 | ✅ Managed |
| **Migrations** | 8 | ✅ All applied |
| **TypeScript Errors** | 0 | ✅ Clean build |
| **Theme Presets** | 3 | ✅ All polished |
| **Test Coverage** | 0% | ⚠️ No E2E tests yet |

---

## 🎯 Immediate Priorities (Post-Session 19)

### High-Value UX Improvements
1. **Appearance Settings UI** - Let users customize theme/accent/font with live preview
2. **Auto-Question Count** - Smart defaults based on note length/density analysis
3. **One-Question-At-A-Time UI** - Less overwhelming quiz experience (modal/popup per question)

### Value-Add Features
4. **Follow-Up Insights** - Post-grade revision suggestions ("What to study next")
5. **Missing Material Analysis** - Pre-quiz gap detection in notes
6. **Database Theme Sync** - Persist user theme preferences to Supabase

### Infrastructure
7. **Feature Flags Audit** - Document all flags, remove stale ones
8. **Data Router Migration** - Migrate from `<BrowserRouter>` to `createBrowserRouter` (for useBlocker)
9. **Light Theme Polish** - Test and refine `academic-light` preset
10. **E2E Testing** - Set up Playwright or Cypress for critical paths

---

## 📖 Reading Guides

### For New Sessions (Claude)
**Path:** Quick context → System design → Development rules
1. [CURRENT_STATE.md](./CURRENT_STATE.md) (5 min) - What's working, what's broken
2. [Architecture.md](./Architecture.md) (15 min) - System overview
3. [Claude_Prompt_v7.md](./Claude_Prompt_v7.md) (10 min) - Constraints & patterns
4. Reference other docs as needed

### For Feature Development
**Path:** Status → Spec → API → Architecture
1. [CURRENT_STATE.md](./CURRENT_STATE.md) - Verify feature status
2. [Features.md](./Features.md) - Read relevant section spec
3. [API_Reference.md](./API_Reference.md) - Check endpoint contracts
4. [Architecture.md](./Architecture.md) - Understand data flows

### For Bug Fixes
**Path:** Known issues → System design → Security check → Module rules
1. [CURRENT_STATE.md](./CURRENT_STATE.md) - Check known issues
2. [Architecture.md](./Architecture.md) - Understand affected systems
3. [Security_Rules.md](./Security_Rules.md) - Verify constraints
4. [ESM_Rules.md](./ESM_Rules.md) - If backend module errors

### For API Integration
**Path:** Endpoints → Auth → Data flow
1. [API_Reference.md](./API_Reference.md) - Find endpoint contracts
2. [Security_Rules.md](./Security_Rules.md) - Understand auth requirements
3. [Architecture.md](./Architecture.md) - Understand validation flow

### For UI/UX Work
**Path:** Design system → Theme tokens → Component patterns
1. [Design_System.md](./Design_System.md) - Visual patterns & guidelines
2. [SESSION_19.md](./SESSION_19.md) - Latest UI/UX changes
3. [Architecture.md](./Architecture.md) - Component structure

---

## 🚨 Known Issues & Limitations

### Minor Issues (Non-Blocking)
- **TypeScript Errors:** 12 errors in legacy/deprecated files (not in active code)
- **Pagination:** ClassNotes loads all notes at once (could paginate for 100+ notes)
- **Rate Limiting:** No rate limits on folder CRUD endpoints yet
- **Bundle Size:** No lazy loading or code splitting optimization

### Known Limitations
- **Rich Text Editor:** ClassNotes uses plain textarea (could upgrade to TipTap/Lexical)
- **Real-time Updates:** Results page doesn't subscribe to new attempts
- **Notes Count Badge:** Could add to dashboard class cards
- **E2E Testing:** No Playwright/Cypress specs yet
- **In-App Navigation Blocking:** Removed `useBlocker` (needs data router for restoration)

See [CURRENT_STATE.md](./CURRENT_STATE.md) for full list.

---

## 💡 Design Philosophy

### Core Principles

**1. Modular Truth**
- Every concept lives in exactly ONE place
- No duplication across documentation
- Cross-reference liberally, copy never

**2. AI-First Documentation**
- Optimized for Claude Code sessions
- Clear section boundaries
- Explicit contracts and constraints
- Timeless specifications (no session logs in core specs)

**3. Production-Ready Always**
- All code follows security rules
- All APIs follow error shape contracts
- All imports follow ESM rules
- All changes respect RLS boundaries

**4. Feature-Flagged Development**
- New features default to OFF
- Rollback without code changes
- Gradual rollout capability

**5. Token-Based Theming**
- All colors use CSS custom properties
- No hardcoded hex values in components
- Themes switch via data attributes
- Semantic token names (not color names)

---

## 📝 Contribution Guidelines

### For Claude Sessions

1. **Always read [CURRENT_STATE.md](./CURRENT_STATE.md) first** before starting work
2. **Update the correct module** - no cross-file duplication
3. **Follow all rules:**
   - [Security_Rules.md](./Security_Rules.md) - RLS, auth, validation
   - [ESM_Rules.md](./ESM_Rules.md) - imports, module resolution
   - API contracts - error shapes, Zod schemas
4. **Update [CURRENT_STATE.md](./CURRENT_STATE.md)** when completing features or finding bugs
5. **Reference session logs** in archive for historical context only

### For Human Developers

1. Read [CURRENT_STATE.md](./CURRENT_STATE.md) for project status
2. Check [Features.md](./Features.md) for product specifications
3. Use [API_Reference.md](./API_Reference.md) for integration work
4. Follow [Security_Rules.md](./Security_Rules.md) and [ESM_Rules.md](./ESM_Rules.md) strictly
5. Update documentation when adding features

---

## 🔗 Quick Links

### Essential Docs
- [CURRENT_STATE.md](./CURRENT_STATE.md) - Project status & priorities
- [ChatGPA_Spec_Hub.md](./ChatGPA_Spec_Hub.md) - Documentation navigation
- [Architecture.md](./Architecture.md) - System design
- [API_Reference.md](./API_Reference.md) - All endpoints
- [Features.md](./Features.md) - Product specs
- [Design_System.md](./Design_System.md) - Theme & UX
- [Security_Rules.md](./Security_Rules.md) - RLS & auth
- [ESM_Rules.md](./ESM_Rules.md) - Module imports

### Session History
- [SESSION_19.md](./SESSION_19.md) - UI/UX overhaul (Nov 19)
- [SESSION_18.md](./SESSION_18.md) - Theme V2 (Nov 18)
- [Session_17_Summary.md](./Session_17_Summary.md) - Error fixes (Nov 11)
- [/docs/archive/sessions/](../archive/sessions/) - Sessions 9-16

### External Resources
- **Repository:** https://github.com/HaiDaPlug/chatgpa
- **Live App:** https://chatgpa.vercel.app (production)
- **Supabase Dashboard:** https://supabase.com/dashboard/project/[project-id]
- **Stripe Dashboard:** https://dashboard.stripe.com

---

## 📞 Support & Contact

**Primary Maintainer:** Hai (solo developer)
**AI Assistant:** Claude Code (Anthropic)
**Orchestration:** ChatGPT (OpenAI)

**For Issues:**
1. Check [CURRENT_STATE.md](./CURRENT_STATE.md) for known issues
2. Review [Architecture.md](./Architecture.md) for system understanding
3. Consult session logs in [/docs/archive/sessions/](../archive/sessions/)

---

## 🎯 Next Steps

- **New Session?** → Start with [CURRENT_STATE.md](./CURRENT_STATE.md)
- **Feature Work?** → Read [Features.md](./Features.md) + [API_Reference.md](./API_Reference.md)
- **Bug Fix?** → Check [CURRENT_STATE.md](./CURRENT_STATE.md) + [Architecture.md](./Architecture.md)
- **System Understanding?** → Read [Architecture.md](./Architecture.md) + [ChatGPA_Spec_Hub.md](./ChatGPA_Spec_Hub.md)

---

**Last Updated:** November 19, 2025 (Session 19 - Landing page + sign-in flow complete)
**Next Review:** After Appearance Settings UI implementation
**Build Status:** ✅ Passing (0 TypeScript errors)

---

> **This is your comprehensive navigation hub for all ChatGPA core documentation.**
> **All truth flows from these modular specifications. Start with CURRENT_STATE.md.**
