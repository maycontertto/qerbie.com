-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_members

begin;

alter table public.merchant_members enable row level security;
alter table public.merchant_members force row level security;

-- Explicit privileges (RLS still applies).
revoke all on table public.merchant_members from anon;
revoke all on table public.merchant_members from authenticated;

grant select, insert, update, delete on table public.merchant_members to authenticated;

-- Read: owner can read all members; a user can read their own memberships.
drop policy if exists merchant_members_select on public.merchant_members;
create policy merchant_members_select
on public.merchant_members
for select
to authenticated
using (
  public.is_merchant_owner(merchant_id)
  or public.has_member_permission(merchant_id, 'manage_attendants')
  or user_id = auth.uid()
);

-- Insert: only merchant owner can add members.
drop policy if exists merchant_members_insert on public.merchant_members;
create policy merchant_members_insert
on public.merchant_members
for insert
to authenticated
with check (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

-- Update: only merchant owner can change roles/members.
drop policy if exists merchant_members_update on public.merchant_members;
create policy merchant_members_update
on public.merchant_members
for update
to authenticated
using (
  public.has_member_permission(merchant_id, 'manage_attendants')
)
with check (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

-- Delete: only merchant owner can remove members.
drop policy if exists merchant_members_delete on public.merchant_members;
create policy merchant_members_delete
on public.merchant_members
for delete
to authenticated
using (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

commit;
