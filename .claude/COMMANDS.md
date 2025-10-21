Useful Commands for Carpool AI (V10)
🚀 Development
# Install deps
cd web && pnpm install

# Run dev (frontend + serverless)
cd web && pnpm dev

# Build / preview
cd web && pnpm build
cd web && pnpm preview

🗄️ Supabase
# Start/stop local Supabase
supabase start
supabase stop

# Migrations
supabase db push

# Reset DB (destructive)
supabase db reset

# Generate TS types from DB
supabase gen types typescript --local > web/src/types/supabase.ts

# Open Studio
supabase studio

🧪 Test API Endpoints (MVP)
# Debug endpoint
curl http://localhost:3000/api/debug

# Fake subscribe (MVP seeding)
curl -X POST http://localhost:3000/api/fake-subscribe \
  -H "Content-Type: application/json" \
  -d '{"tier":"cruiser","userId":"YOUR_USER_UUID"}'

# Streaming chat (SSE; shows raw events)
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hi!"}]}'

🔍 Database Quick Checks (MVP vs Canon)
-- MVP fuel (current loop)
select * from mvp_fuel where user_id = 'YOUR_USER_UUID';

-- MVP subscription
select * from mvp_subscription where user_id = 'YOUR_USER_UUID';

/* Canon tables (for when Stripe/webhooks are live) */
-- select * from token_ledger;
-- select * from subscriptions;
-- select * from community_pool;

📦 Stripe (Stubbed / Optional for now)
# Listen to webhooks locally (only when re-enabling Stripe)
stripe listen --forward-to localhost:3000/api/stripe-webhook

# Trigger test events (optional)
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted

🔐 Environment Setup
# Copy example env → local client env
cp web/.env.example web/.env.local

# Edit with your keys
nano web/.env.local

# Pull Vercel env (server) for verification
vercel env pull


Client (.env.local / Vite)

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=


Server (Vercel env)

SUPABASE_URL=
SUPABASE_SERVICE_ROLE=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5   # optional
# Stripe keys remain but are unused until re-enabled

🐛 Debugging
# Vercel logs (all)
vercel logs

# Stream specific function logs
vercel logs --follow api/chat
vercel logs --follow api/fake-subscribe

🎨 Frontend
# New component/page
touch web/src/components/NewComponent.tsx
touch web/src/pages/NewPage.tsx

# Type check
cd web && pnpm tsc --noEmit

🚢 Deployment
# Deploy (Vercel)
vercel deploy
vercel --prod

# Env management
vercel env ls
vercel env add SUPABASE_URL production