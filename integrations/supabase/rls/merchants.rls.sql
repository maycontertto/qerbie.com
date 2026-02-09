-- Qerbie / Supabase RLS Policies
-- Table: public.merchants

begin;

alter table public.merchants enable row level security;
alter table public.merchants force row level security;

-- Explicit privileges (RLS still applies).
revoke all on table public.merchants from anon;
revoke all on table public.merchants from authenticated;

grant select, insert, update, delete on table public.merchants to authenticated;

-- Read: owner can read; members can read.
drop policy if exists merchants_select on public.merchants;
create policy merchants_select
on public.merchants
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_merchant_member(id)
);

-- Create: only the user themself can become owner.
drop policy if exists merchants_insert on public.merchants;
create policy merchants_insert
on public.merchants
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
);

-- Update: only owner.
drop policy if exists merchants_update on public.merchants;
create policy merchants_update
on public.merchants
for update
to authenticated
using (
  owner_user_id = auth.uid()
  or public.has_member_permission(id, 'dashboard_branding')
  or public.has_member_permission(id, 'dashboard_delivery')
  or public.has_member_permission(id, 'dashboard_support')
  or public.has_member_permission(id, 'dashboard_sales')
)
with check (
  -- Owner can update freely; members can update but cannot change ownership.
  owner_user_id = auth.uid()
  or owner_user_id is not distinct from (
    select m.owner_user_id from public.merchants m where m.id = public.merchants.id
  )
);

-- Delete: only owner.
drop policy if exists merchants_delete on public.merchants;
create policy merchants_delete
on public.merchants
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

commit;
