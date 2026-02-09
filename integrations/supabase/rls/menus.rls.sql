-- Qerbie / Supabase RLS Policies
-- Table: public.menus

begin;

alter table public.menus enable row level security;
alter table public.menus force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.menus from anon;
revoke all on table public.menus from authenticated;

-- Customers (anon) can only read.
grant select on table public.menus to anon;
-- Merchants (authenticated) can manage.
grant select, insert, update, delete on table public.menus to authenticated;

-- ── Anon (customers via QR) ─────────────────────────────────
-- Customers see only active menus. No auth required.
drop policy if exists menus_anon_select on public.menus;
create policy menus_anon_select
on public.menus
for select
to anon
using (
  is_active = true
);

-- ── Authenticated (merchant staff) ─────────────────────────
-- Owner or member can read ALL menus (including inactive) of
-- their merchant.
drop policy if exists menus_auth_select on public.menus;
create policy menus_auth_select
on public.menus
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

-- Insert: owner or member can create menus for their merchant.
drop policy if exists menus_auth_insert on public.menus;
create policy menus_auth_insert
on public.menus
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

-- Update: owner or member.
drop policy if exists menus_auth_update on public.menus;
create policy menus_auth_update
on public.menus
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only (destructive action).
drop policy if exists menus_auth_delete on public.menus;
create policy menus_auth_delete
on public.menus
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
