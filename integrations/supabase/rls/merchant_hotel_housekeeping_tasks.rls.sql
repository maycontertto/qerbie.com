-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_hotel_housekeeping_tasks

begin;

alter table public.merchant_hotel_housekeeping_tasks enable row level security;
alter table public.merchant_hotel_housekeeping_tasks force row level security;

revoke all on table public.merchant_hotel_housekeeping_tasks from anon;
revoke all on table public.merchant_hotel_housekeeping_tasks from authenticated;

grant select, insert, update, delete on table public.merchant_hotel_housekeeping_tasks to authenticated;

drop policy if exists hotel_housekeeping_tasks_auth_select on public.merchant_hotel_housekeeping_tasks;
create policy hotel_housekeeping_tasks_auth_select
on public.merchant_hotel_housekeeping_tasks
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists hotel_housekeeping_tasks_auth_insert on public.merchant_hotel_housekeeping_tasks;
create policy hotel_housekeeping_tasks_auth_insert
on public.merchant_hotel_housekeeping_tasks
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_housekeeping_tasks_auth_update on public.merchant_hotel_housekeeping_tasks;
create policy hotel_housekeeping_tasks_auth_update
on public.merchant_hotel_housekeeping_tasks
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists hotel_housekeeping_tasks_auth_delete on public.merchant_hotel_housekeeping_tasks;
create policy hotel_housekeeping_tasks_auth_delete
on public.merchant_hotel_housekeeping_tasks
for delete
to authenticated
using (public.has_merchant_access(merchant_id));

commit;
