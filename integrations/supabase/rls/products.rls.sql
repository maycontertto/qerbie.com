-- Qerbie / Supabase RLS Policies
-- Table: public.products

begin;

alter table public.products enable row level security;
alter table public.products force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.products from anon;
revoke all on table public.products from authenticated;

grant select on table public.products to anon;
grant select, insert, update, delete on table public.products to authenticated;

-- ── Anon (customers via QR) ─────────────────────────────────
drop policy if exists products_anon_select on public.products;
create policy products_anon_select
on public.products
for select
to anon
using (
  is_active = true
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists products_auth_select on public.products;
create policy products_auth_select
on public.products
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists products_auth_insert on public.products;
create policy products_auth_insert
on public.products
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists products_auth_update on public.products;
create policy products_auth_update
on public.products
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists products_auth_delete on public.products;
create policy products_auth_delete
on public.products
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
