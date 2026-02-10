-- Qerbie / Supabase RLS Policies
-- Table: public.gym_payments

begin;

alter table public.gym_payments enable row level security;
alter table public.gym_payments force row level security;

revoke all on table public.gym_payments from anon;
revoke all on table public.gym_payments from authenticated;

grant select, insert, update, delete on table public.gym_payments to authenticated;

drop policy if exists gym_payments_auth_select on public.gym_payments;
create policy gym_payments_auth_select
on public.gym_payments
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_payments_auth_insert on public.gym_payments;
create policy gym_payments_auth_insert
on public.gym_payments
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_payments_auth_update on public.gym_payments;
create policy gym_payments_auth_update
on public.gym_payments
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_payments_auth_delete on public.gym_payments;
create policy gym_payments_auth_delete
on public.gym_payments
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
