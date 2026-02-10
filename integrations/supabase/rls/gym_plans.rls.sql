-- Qerbie / Supabase RLS Policies
-- Table: public.gym_plans

begin;

alter table public.gym_plans enable row level security;
alter table public.gym_plans force row level security;

revoke all on table public.gym_plans from anon;
revoke all on table public.gym_plans from authenticated;

grant select on table public.gym_plans to anon;
grant select, insert, update, delete on table public.gym_plans to authenticated;

-- Anon (gym customer portal): list active plans
drop policy if exists gym_plans_anon_select on public.gym_plans;
create policy gym_plans_anon_select
on public.gym_plans
for select
to anon
using (
	is_active = true
);

drop policy if exists gym_plans_auth_select on public.gym_plans;
create policy gym_plans_auth_select
on public.gym_plans
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_plans_auth_insert on public.gym_plans;
create policy gym_plans_auth_insert
on public.gym_plans
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_plans_auth_update on public.gym_plans;
create policy gym_plans_auth_update
on public.gym_plans
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_plans_auth_delete on public.gym_plans;
create policy gym_plans_auth_delete
on public.gym_plans
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
