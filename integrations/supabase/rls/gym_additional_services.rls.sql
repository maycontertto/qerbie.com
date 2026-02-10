-- Qerbie / Supabase RLS Policies
-- Table: public.gym_additional_services

begin;

alter table public.gym_additional_services enable row level security;
alter table public.gym_additional_services force row level security;

revoke all on table public.gym_additional_services from anon;
revoke all on table public.gym_additional_services from authenticated;

grant select, insert, update, delete on table public.gym_additional_services to authenticated;

drop policy if exists gym_additional_services_auth_select on public.gym_additional_services;
create policy gym_additional_services_auth_select
on public.gym_additional_services
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_additional_services_auth_insert on public.gym_additional_services;
create policy gym_additional_services_auth_insert
on public.gym_additional_services
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_additional_services_auth_update on public.gym_additional_services;
create policy gym_additional_services_auth_update
on public.gym_additional_services
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_additional_services_auth_delete on public.gym_additional_services;
create policy gym_additional_services_auth_delete
on public.gym_additional_services
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
