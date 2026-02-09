-- Qerbie / Supabase RLS Policies
-- Table: public.menu_categories

begin;

alter table public.menu_categories enable row level security;
alter table public.menu_categories force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.menu_categories from anon;
revoke all on table public.menu_categories from authenticated;

-- Customers (anon) can only read.
grant select on table public.menu_categories to anon;
-- Merchants (authenticated) can manage.
grant select, insert, update, delete on table public.menu_categories to authenticated;

-- ── Anon (customers via QR) ─────────────────────────────────
-- Customers see only active categories.
drop policy if exists menu_categories_anon_select on public.menu_categories;
create policy menu_categories_anon_select
on public.menu_categories
for select
to anon
using (
  is_active = true
);

-- ── Authenticated (merchant staff) ─────────────────────────
-- Owner or member can read ALL categories of their merchant.
drop policy if exists menu_categories_auth_select on public.menu_categories;
create policy menu_categories_auth_select
on public.menu_categories
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

-- Insert: owner or member.
drop policy if exists menu_categories_auth_insert on public.menu_categories;
create policy menu_categories_auth_insert
on public.menu_categories
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

-- Update: owner or member.
drop policy if exists menu_categories_auth_update on public.menu_categories;
create policy menu_categories_auth_update
on public.menu_categories
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only (destructive action).
drop policy if exists menu_categories_auth_delete on public.menu_categories;
create policy menu_categories_auth_delete
on public.menu_categories
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
