-- 2025-09-29_security-hardening.sql
-- Purpose: Pin search_path, switch to SECURITY INVOKER, add security barrier to views, tighten grants.
-- Re-runnable: yes

begin;

-- FUNCTIONS: switch to invoker + pin search_path
alter function public.monthly_rollover() security invoker;
alter function public.monthly_rollover() set search_path = pg_catalog, public;

alter function public.apply_monthly_allocation(uuid, bigint, bigint) security invoker;
alter function public.apply_monthly_allocation(uuid, bigint, bigint) set search_path = pg_catalog, public;

alter function public.spend_tokens(uuid, bigint) security invoker;
alter function public.spend_tokens(uuid, bigint) set search_path = pg_catalog, public;

-- VIEWS: add security barrier (safe to re-run)
alter view public.v_waitlist_counts       set (security_barrier = true);
alter view public.v_waitlist_by_source    set (security_barrier = true);
alter view public.v_waitlist_stats        set (security_barrier = true);

-- GRANTS: lock down who can run what (optional, re-runnable)
revoke all on function public.monthly_rollover() from public;
revoke all on function public.apply_monthly_allocation(uuid, bigint, bigint) from public;
revoke all on function public.spend_tokens(uuid, bigint) from public;

grant execute on function public.monthly_rollover() to service_role;
grant execute on function public.apply_monthly_allocation(uuid, bigint, bigint) to service_role;
grant execute on function public.spend_tokens(uuid, bigint) to authenticated;

commit;

-- VERIFY (run separately after):
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
-- from pg_proc p join pg_namespace n on n.oid=p.pronamespace
-- where n.nspname='public' and p.proname in ('monthly_rollover','spend_tokens','apply_monthly_allocation');
