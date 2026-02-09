-- Qerbie / Supabase RLS Policies
-- Table: public.product_options

begin;

alter table public.product_options enable row level security;
alter table public.product_options force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.product_options from anon;
revoke all on table public.product_options from authenticated;

grant select on table public.product_options to anon;
grant select, insert, update, delete on table public.product_options to authenticated;

-- ── Anon (customers via QR) ─────────────────────────────────
-- Customers see only active options (inactive = unavailable).
drop policy if exists product_options_anon_select on public.product_options;
create policy product_options_anon_select
on public.product_options
for select
to anon
using (
  is_active = true
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists product_options_auth_select on public.product_options;
create policy product_options_auth_select
on public.product_options
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists product_options_auth_insert on public.product_options;
create policy product_options_auth_insert
on public.product_options
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists product_options_auth_update on public.product_options;
create policy product_options_auth_update
on public.product_options
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists product_options_auth_delete on public.product_options;
create policy product_options_auth_delete
on public.product_options
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
