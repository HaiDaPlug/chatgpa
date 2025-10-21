-- Add Stripe-specific columns to mvp_billing
-- This migration is idempotent and safe to run multiple times

-- Add customer_id and subscription_id columns for Stripe
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mvp_billing'
      and column_name = 'customer_id'
  ) then
    alter table public.mvp_billing add column customer_id text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mvp_billing'
      and column_name = 'subscription_id'
  ) then
    alter table public.mvp_billing add column subscription_id text;
  end if;
end$$;

-- Update provider default to 'stripe' for new rows (preserves existing 'lemonsqueezy' rows)
alter table public.mvp_billing alter column provider set default 'stripe';

-- Add helpful comment
comment on column public.mvp_billing.customer_id is 'Stripe customer ID (cus_xxx)';
comment on column public.mvp_billing.subscription_id is 'Stripe subscription ID (sub_xxx)';
comment on table public.mvp_billing is 'Billing records for both Stripe and legacy Lemon Squeezy subscriptions';
