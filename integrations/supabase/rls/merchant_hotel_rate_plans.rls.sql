-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_hotel_rate_plans

begin;

alter table public.merchant_hotel_rate_plans enable row level security;
alter table public.merchant_hotel_rate_plans force row level security;

revoke all on table public.merchant_hotel_rate_plans from anon;
revoke all on table public.merchant_hotel_rate_plans from authenticated;

grant select, insert, update, delete on table public.merchant_hotel_rate_plans to authenticated;

drop policy if exists hotel_rate_plans_auth_select on public.merchant_hotel_rate_plans;
create policy hotel_rate_plans_auth_select
on public.merchant_hotel_rate_plans
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists hotel_rate_plans_auth_insert on public.merchant_hotel_rate_plans;
create policy hotel_rate_plans_auth_insert
on public.merchant_hotel_rate_plans
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_rate_plans_auth_update on public.merchant_hotel_rate_plans;
create policy hotel_rate_plans_auth_update
on public.merchant_hotel_rate_plans
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_rate_plans_auth_delete on public.merchant_hotel_rate_plans;
create policy hotel_rate_plans_auth_delete
on public.merchant_hotel_rate_plans
for delete
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
