-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_hotel_guests

begin;

alter table public.merchant_hotel_guests enable row level security;
alter table public.merchant_hotel_guests force row level security;

revoke all on table public.merchant_hotel_guests from anon;
revoke all on table public.merchant_hotel_guests from authenticated;

grant select, insert, update, delete on table public.merchant_hotel_guests to authenticated;

drop policy if exists hotel_guests_auth_select on public.merchant_hotel_guests;
create policy hotel_guests_auth_select
on public.merchant_hotel_guests
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists hotel_guests_auth_insert on public.merchant_hotel_guests;
create policy hotel_guests_auth_insert
on public.merchant_hotel_guests
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_guests_auth_update on public.merchant_hotel_guests;
create policy hotel_guests_auth_update
on public.merchant_hotel_guests
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_guests_auth_delete on public.merchant_hotel_guests;
create policy hotel_guests_auth_delete
on public.merchant_hotel_guests
for delete
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
