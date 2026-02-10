-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_subscriptions

begin;

alter table public.merchant_subscriptions enable row level security;
alter table public.merchant_subscriptions force row level security;

revoke all on table public.merchant_subscriptions from anon;
revoke all on table public.merchant_subscriptions from authenticated;

-- Authenticated users can read their merchant subscription.
grant select on table public.merchant_subscriptions to authenticated;

drop policy if exists merchant_subscriptions_auth_select on public.merchant_subscriptions;
create policy merchant_subscriptions_auth_select
on public.merchant_subscriptions
for select
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
