-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_hotel_room_types

begin;

alter table public.merchant_hotel_room_types enable row level security;
alter table public.merchant_hotel_room_types force row level security;

revoke all on table public.merchant_hotel_room_types from anon;
revoke all on table public.merchant_hotel_room_types from authenticated;

grant select, insert, update, delete on table public.merchant_hotel_room_types to authenticated;

drop policy if exists hotel_room_types_auth_select on public.merchant_hotel_room_types;
create policy hotel_room_types_auth_select
on public.merchant_hotel_room_types
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists hotel_room_types_auth_insert on public.merchant_hotel_room_types;
create policy hotel_room_types_auth_insert
on public.merchant_hotel_room_types
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_room_types_auth_update on public.merchant_hotel_room_types;
create policy hotel_room_types_auth_update
on public.merchant_hotel_room_types
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_room_types_auth_delete on public.merchant_hotel_room_types;
create policy hotel_room_types_auth_delete
on public.merchant_hotel_room_types
for delete
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
