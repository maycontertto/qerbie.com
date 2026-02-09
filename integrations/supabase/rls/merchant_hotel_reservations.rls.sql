-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_hotel_reservations

begin;

alter table public.merchant_hotel_reservations enable row level security;
alter table public.merchant_hotel_reservations force row level security;

revoke all on table public.merchant_hotel_reservations from anon;
revoke all on table public.merchant_hotel_reservations from authenticated;

grant select, insert, update, delete on table public.merchant_hotel_reservations to authenticated;

drop policy if exists hotel_reservations_auth_select on public.merchant_hotel_reservations;
create policy hotel_reservations_auth_select
on public.merchant_hotel_reservations
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists hotel_reservations_auth_insert on public.merchant_hotel_reservations;
create policy hotel_reservations_auth_insert
on public.merchant_hotel_reservations
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_reservations_auth_update on public.merchant_hotel_reservations;
create policy hotel_reservations_auth_update
on public.merchant_hotel_reservations
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_reservations_auth_delete on public.merchant_hotel_reservations;
create policy hotel_reservations_auth_delete
on public.merchant_hotel_reservations
for delete
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
