-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_tables

begin;

alter table public.merchant_tables enable row level security;
alter table public.merchant_tables force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.merchant_tables from anon;
revoke all on table public.merchant_tables from authenticated;

grant select on table public.merchant_tables to anon;
grant select, insert, update, delete on table public.merchant_tables to authenticated;

-- ── Anon (customers via QR) ─────────────────────────────────
-- Customers can look up a table by its qr_token (needed to resolve
-- which merchant & table the QR points to).  Only active tables.
drop policy if exists merchant_tables_anon_select on public.merchant_tables;
create policy merchant_tables_anon_select
on public.merchant_tables
for select
to anon
using (
  is_active = true
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists merchant_tables_auth_select on public.merchant_tables;
create policy merchant_tables_auth_select
on public.merchant_tables
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_tables_auth_insert on public.merchant_tables;
create policy merchant_tables_auth_insert
on public.merchant_tables
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_tables_auth_update on public.merchant_tables;
create policy merchant_tables_auth_update
on public.merchant_tables
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists merchant_tables_auth_delete on public.merchant_tables;
create policy merchant_tables_auth_delete
on public.merchant_tables
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
