-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_invites

begin;

alter table public.merchant_invites enable row level security;
alter table public.merchant_invites force row level security;

revoke all on table public.merchant_invites from anon;
revoke all on table public.merchant_invites from authenticated;

grant select, insert, update, delete on table public.merchant_invites to authenticated;

-- Owner can manage invites for their merchant.
drop policy if exists merchant_invites_owner_select on public.merchant_invites;
create policy merchant_invites_owner_select
on public.merchant_invites
for select
to authenticated
using (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

drop policy if exists merchant_invites_owner_insert on public.merchant_invites;
create policy merchant_invites_owner_insert
on public.merchant_invites
for insert
to authenticated
with check (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

drop policy if exists merchant_invites_owner_update on public.merchant_invites;
create policy merchant_invites_owner_update
on public.merchant_invites
for update
to authenticated
using (
  public.has_member_permission(merchant_id, 'manage_attendants')
)
with check (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

drop policy if exists merchant_invites_owner_delete on public.merchant_invites;
create policy merchant_invites_owner_delete
on public.merchant_invites
for delete
to authenticated
using (
  public.has_member_permission(merchant_id, 'manage_attendants')
);

commit;
