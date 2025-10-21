Common Tasks & Recipes (V10)
🎯 Add/Change Tier (MVP vs Stripe)

MVP (no Stripe):

Update copy on Landing.tsx (prices shown to users).

Adjust seed amounts (if needed) in api/fake-subscribe.ts → TIERS.

(Optional) Update any displayed token counts in UI.

Stripe (later):

Update shared/tokens.ts (locked formulas).

Add Price in Stripe; set STRIPE_PRICE_* envs.

Map price↔tier in create-checkout-session.ts & webhook.

If you use an enum tier, add value in SQL + migration.

supabase db push and regen TS types.

🎯 Test the MVP full loop (no Stripe)

Sign in (Supabase Auth).

Click a tier on Landing → calls /api/fake-subscribe.

Visit /chat → send a message.

Watch FuelMeter drain (live from mvp_fuel).

Troubleshooting:

If CTA does nothing, check console and Vercel logs for api/fake-subscribe.

If meter doesn’t move, verify mvp_fuel row exists and RLS policies.

🎯 Streaming Chat sanity test

OPENAI_API_KEY set in Vercel.

Post to /api/chat (see curl above).

In UI, send a message → see (streaming…) then assistant text.

Fuel deducts once after stream ends (estimated tokens).

🎯 Switch from MVP → Stripe (when verified)

Swap Landing CTAs from fakeSubscribe() back to checkout().

Enable create-checkout-session.ts and stripe-webhook.ts.

Webhook seeds canonical tables (or writes into mvp_* first, then migrate).

Remove api/fake-subscribe.ts when stable.

Keep UI unchanged.

🎯 Update database schema

Write SQL: supabase/migrations/YYYYMMDD_description.sql

Test locally: supabase db reset

Push: supabase db push

Types: supabase gen types typescript --local > web/src/types/supabase.ts

🎯 Debug token spending (MVP)
-- Current fuel
select personal, reserve, pool_bonus
from mvp_fuel where user_id = 'YOUR_USER_UUID';

-- Manually add tokens (testing)
update mvp_fuel set personal = personal + 100000
where user_id = 'YOUR_USER_UUID';

-- Confirm row-level visibility
set role anon;  -- (only in local dev, with caution)
-- select ... from mvp_fuel where user_id='...';


Canon RPCs like spend_tokens / monthly_rollover are for the Stripe path and are not used by the MVP loop.

🎯 Test email (Resend)
curl -X POST http://localhost:3000/api/email-test \
  -H "Content-Type: application/json" \
  -d '{"to":"you@example.com"}'

🎯 Admin bypass (if you re-enable waitlist gate)

Set ADMIN_BYPASS_KEY in Vercel env.

Visit /api/bypass?token=YOUR_KEY (cookie 24h).

🎯 Vercel deploy gotchas

Ensure imports use @/lib/supabase (not @/supabase).

If a serverless fn fails: vercel logs --follow api/<name>.

Types mismatch? Regenerate Supabase types.

💵 Current Pricing (as of now)

Cruiser: $5.50/mo (entry tier)

Power: $7.99/mo 

Pro: $14.99/mo