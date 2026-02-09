-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_hotel_services

begin;

alter table public.merchant_hotel_services enable row level security;
alter table public.merchant_hotel_services force row level security;

revoke all on table public.merchant_hotel_services from anon;
revoke all on table public.merchant_hotel_services from authenticated;

grant select, insert, update, delete on table public.merchant_hotel_services to authenticated;

drop policy if exists hotel_services_auth_select on public.merchant_hotel_services;
create policy hotel_services_auth_select
on public.merchant_hotel_services
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists hotel_services_auth_insert on public.merchant_hotel_services;
create policy hotel_services_auth_insert
on public.merchant_hotel_services
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_services_auth_update on public.merchant_hotel_services;
create policy hotel_services_auth_update
on public.merchant_hotel_services
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_services_auth_delete on public.merchant_hotel_services;
create policy hotel_services_auth_delete
on public.merchant_hotel_services
for delete
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
