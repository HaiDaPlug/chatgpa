# Carpool AI – Project Context (V11 - Oct 2, 2025)

## 🎯 Project Overview
Carpool AI is a GPT-5 subscription service with a unique **fuel pooling** model.  
Users subscribe to tiers, get monthly token allocations, and share a community pool bonus.  
MVP currently runs on a **fake-subscribe flow** (no Stripe) to demo the loop end-to-end.

---

## 🏗️ Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase (PostgreSQL, RLS enforced)
- **Payments**: Stripe (scaffolded, not active yet)
- **Email**: Resend (waitlist)
- **Auth**: Supabase Auth

---

## 📁 Key File Locations
web/
├── src/
│ ├── pages/ # Landing (public, includes waitlist), Chat, Account
│ ├── components/ # TierCard, FuelMeter, Chat, WaitlistGate
│ ├── hooks/ # useFuel
│ └── lib/ # supabase.ts (client, auth helpers, getSession, getUserId)
├── api/ # Vercel serverless functions
│ ├── join-waitlist.ts # Waitlist email capture + Resend confirmation
│ ├── fake-subscribe.ts # MVP-only tier seeding
│ ├── chat.ts # Streaming GPT-5 proxy
│ ├── create-checkout-session.ts (Stripe, stubbed)
│ ├── stripe-webhook.ts (stubbed)
│ └── debug.ts
├── public/ # Static assets
│ ├── favicon.svg, favicon.png
│ ├── robots.txt
│ └── sitemap.xml
└── supabase/
  └── migrations/ # Database migrations
    ├── 20251002_mvp_baseline.sql # MVP tables (subscription, fuel)
    └── 20251002_waitlist_emails.sql # Waitlist capture table

---

## 💰 Token Economics (v2.1 – LOCKED)
**GPT-5 Cost**: $1 ≈ 178k tokens  

### Monthly Allocations (Personal Fuel)
- **Cruiser**: 178k ($5.50)
- **Power**: 356k ($7.99)
- **Pro**: 711k ($14.99)

### Reserve Caps (Rollover)
- Cruiser: 890k (5×)
- Power: 1,780k (5×)
- Pro: 3,560k (5×)

### Spending Order
1. Personal →  
2. Reserve →  
3. Community pool bonus  

---

## 🔄 Monthly Rollover Logic
1. Each user contributes buffer tokens → community pool  
2. On the 1st: pool splits evenly → everyone’s Personal  
3. Remaining Personal → Reserve (capped)  
4. New month’s allocation → Personal  

---

## 🎨 Design System
- **Dark theme**: Warm dark (stone-900 background, stone-100 text)
- **Typography**: System UI, `font-semibold`, `tracking-tight`
- **Colors**: Stone palette (700/800 borders, 100 accents), warm hierarchy
- **Minimal**: Clean, scannable, no clutter

---

## 🚧 Current Status (V11 - Oct 2, 2025)
- ✅ **Single Landing page at root** (public, no auth required)
- ✅ **Landing-as-Waitlist** with Early Access switch (`VITE_EARLY_ACCESS` env flag)
- ✅ Waitlist form wired to `/api/join-waitlist` with real-time validation
- ✅ Pricing section with TierCards (shows when `VITE_EARLY_ACCESS=true` + authenticated)
- ✅ Auth flow: Google OAuth + header login/logout/chat navigation
- ✅ Hash-scroll support (`/#fuel` auto-scrolls to waitlist form)
- ✅ 301 redirect: `/waitlist` → `/` (legacy links)
- ✅ SEO: canonical link, robots.txt, sitemap.xml, meta description
- ✅ Database schema (Supabase + RLS): `mvp_subscription`, `mvp_fuel`, `waitlist_emails`
- ✅ Fake-subscribe API + MVP tier seeding flow
- ✅ FuelMeter live (Supabase realtime via `useFuel`)
- ✅ Chat interface streams GPT-5 replies via `/api/chat`
- ✅ Fuel deduction per message (estimated tokens)
- ✅ Favicon integrated into header
- 🚧 Account dashboard (fuel left, manage billing)
- 🚧 Stripe integration (blocked by verification)
- ❌ Production token counting (currently heuristic)  

---

## 🔑 Environment Variables
```bash
# Feature Flags
VITE_EARLY_ACCESS=false  # Set to 'true' to enable Early Access mode (pricing section)
VITE_BILLING_MODE=fake   # 'lemonsqueezy' or 'fake' (dev mode)

# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5

# Lemon Squeezy (when VITE_BILLING_MODE='lemonsqueezy')
LS_API_KEY=
LS_STORE_ID=
LS_WEBHOOK_SECRET=
LS_VARIANT_CRUISER=  # Variant ID for Cruiser tier
LS_VARIANT_POWER=    # Variant ID for Power tier
LS_VARIANT_PRO=      # Variant ID for Pro tier
BASE_URL=https://carpoolai.app  # For LS checkout redirect

# Stripe (deprecated - using Lemon Squeezy instead)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
# STRIPE_PRICE_CRUISER=
# STRIPE_PRICE_POWER=
# STRIPE_PRICE_PRO=

# Email (waitlist)
RESEND_API_KEY=
FROM_EMAIL=Carpool AI <contact@khyteteam.com>
PUBLIC_BASE_URL=https://carpoolai.app

# CORS
ALLOWED_ORIGIN=https://carpoolai.app  # Comma-separated list
## 📝 Recent Changes

### Oct 6, 2025 Session (Part 2) - API Consolidation for Vercel Hobby Plan
- **Reduced serverless functions from 13 → 7** (well under 12-function Hobby plan limit)
- **Created `web/api/router.ts`**: Consolidated router handling multiple actions:
  - `join-waitlist` → email capture + Resend confirmation
  - `ls-create-checkout` → Lemon Squeezy checkout creation
  - `fake-subscribe` → MVP tier seeding (dev mode)
- **Updated `vercel.json`**: Added rewrites for transparent routing:
  - `/api/join-waitlist` → `/api/router?action=join-waitlist`
  - `/api/ls-create-checkout` → `/api/router?action=ls-create-checkout`
  - `/api/fake-subscribe` → `/api/router?action=fake-subscribe`
- **Organized `disabled_api/` folder**:
  - `consolidated/` - Original standalone endpoints (now in router)
  - `stripe/` - Deprecated Stripe integration files
  - `misc/` - Testing/debug endpoints (bypass, email-test, me)
- **Active endpoints (7)**: chat, debug, ls-webhook, monthly-rollover, ping, router, use-tokens
- **Updated email template**: Warm-dark stone theme matching landing page, favicon instead of emoji

### Oct 6, 2025 Session (Part 1) - Lemon Squeezy Integration
- **Added Lemon Squeezy billing integration** (replaces Stripe)
- **Updated `ls-webhook.ts`**: Now calls `seed_after_purchase` RPC on subscription creation
- **Updated `chat.ts` API**: Calls `spend_tokens` RPC after streaming, returns updated fuel balances
- **Updated `Account.tsx`**: Reads from `v_account` view to display tier, status, and fuel tokens
- **Updated `Landing.tsx`**: Tier selection supports both `lemonsqueezy` and `fake` modes via `VITE_BILLING_MODE`
- **Added `VITE_BILLING_MODE` env flag**: Controls billing provider ('lemonsqueezy' or 'fake')
- **Database migration ready**: `20251006_gott_och_blandat.sql` adds:
  - `mvp_billing` table for Lemon Squeezy subscriptions
  - `v_account` view joining billing, subscription, and fuel data
  - `mvp_usage_logs` table for token usage tracking
  - `spend_tokens()` RPC for idempotent token deduction
  - `seed_after_purchase()` RPC for initial fuel seeding

**Next step**: Apply migration via Supabase Dashboard SQL Editor

### Oct 2, 2025 Session - Landing-as-Waitlist with Early Access Switch
- **Removed separate `/waitlist` page** → consolidated to single Landing at root `/`
- **Added `VITE_EARLY_ACCESS` env flag** to control Stage 1 (waitlist) vs Stage 2 (pricing)
- **Wired waitlist form** to `/api/join-waitlist` with real-time feedback (success/duplicate/error)
- **Added Pricing section** with TierCards (Cruiser/Power/Pro) - only visible when authenticated + `VITE_EARLY_ACCESS=true`
- **Implemented auth flow**: Google OAuth, dynamic header (login/logout/go-to-chat)
- **Added hash-scroll support**: `/#fuel` auto-scrolls to waitlist form with smooth behavior
- **Created `vercel.json`**: 301 redirect `/waitlist` → `/`, SPA rewrites for client-side routing
- **SEO polish**: canonical link, robots.txt, sitemap.xml, enhanced meta tags
- **Updated `supabase.ts`**: Added `getSession()`, `signInWithGoogle()`, `signOut()` helpers
- **Created `waitlist_emails` migration** with RLS policies (service-role only access)
- **Updated TierCard.tsx**: Warm-dark theme (stone palette), onClick handler for tier selection
- **Integrated favicon** into header logo (replaced gradient placeholder)
- **Updated `WaitlistGate`**: Now redirects to `/#fuel` instead of `/waitlist`

### Stage 1 (Current - Public Waitlist Mode)
- `VITE_EARLY_ACCESS=false` (default)
- All CTAs scroll to waitlist form (`#fuel`)
- No login required to view landing
- Form submits → email saved → confirmation sent via Resend

### Stage 2 (Early Access - Ready to Flip)
- Set `VITE_EARLY_ACCESS=true` in Vercel env
- **If authenticated**: Pricing section shows, tier CTAs → `/api/fake-subscribe` → navigate to `/chat`
- **If not authenticated**: CTAs still scroll to waitlist form

---

## 🎯 Next Steps
- Replace heuristic drain with real token usage from OpenAI API metadata
- Build Account page (tier, fuel left, billing portal stub)
- Add loading/error boundaries + mobile polish
- Re-enable Stripe when verification passes → replace fakeSubscribe with checkout + webhook
- Soft launch: Set `VITE_EARLY_ACCESS=true` when ready for Early Access
- Monitor waitlist conversion + analytics

---

## 💡 Tips for Claude
- Always check `supabase/migrations/*.sql` for RLS & schema
- **pnpm only** (never npm/yarn)
- API endpoints are in `/api/` — test with debug.ts
- **Routing**: Single Landing page at `/` (no separate waitlist page)
- **Feature flag**: Check `VITE_EARLY_ACCESS` env var for Stage 1/2 behavior
- Keep warm-dark aesthetic (stone-900/800/700/100 palette) consistent across all pages
- Never touch locked formulas in token economics
- Preserve scrollable design with hash-scroll support (`#fuel`, `#pricing`, etc.)
- Auth helpers available: `getUserId()`, `getSession()`, `signInWithGoogle()`, `signOut()`
- `/waitlist` → `/` (301 redirect via vercel.json)