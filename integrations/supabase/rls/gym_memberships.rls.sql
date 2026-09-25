-- Qerbie / Supabase RLS Policies
-- Table: public.gym_memberships

begin;

alter table public.gym_memberships enable row level security;
alter table public.gym_memberships force row level security;

revoke all on table public.gym_memberships from public, anon;
revoke all on table public.gym_memberships from authenticated;

grant select, insert, update, delete on table public.gym_memberships to authenticated;

-- Authenticated: merchant staff

drop policy if exists gym_memberships_auth_select on public.gym_memberships;
create policy gym_memberships_auth_select
on public.gym_memberships
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_memberships_auth_insert on public.gym_memberships;
create policy gym_memberships_auth_insert
on public.gym_memberships
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_memberships_auth_update on public.gym_memberships;
create policy gym_memberships_auth_update
on public.gym_memberships
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_memberships_auth_delete on public.gym_memberships;
create policy gym_memberships_auth_delete
on public.gym_memberships
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
