-- Qerbie / Supabase RLS Policies
-- Table: public.product_option_groups

begin;

alter table public.product_option_groups enable row level security;
alter table public.product_option_groups force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.product_option_groups from anon;
revoke all on table public.product_option_groups from authenticated;

grant select on table public.product_option_groups to anon;
grant select, insert, update, delete on table public.product_option_groups to authenticated;

-- ── Anon (customers via QR) ─────────────────────────────────
-- Customers see all option groups (visibility driven by parent product).
drop policy if exists product_option_groups_anon_select on public.product_option_groups;
create policy product_option_groups_anon_select
on public.product_option_groups
for select
to anon
using (true);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists product_option_groups_auth_select on public.product_option_groups;
create policy product_option_groups_auth_select
on public.product_option_groups
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists product_option_groups_auth_insert on public.product_option_groups;
create policy product_option_groups_auth_insert
on public.product_option_groups
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists product_option_groups_auth_update on public.product_option_groups;
create policy product_option_groups_auth_update
on public.product_option_groups
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists product_option_groups_auth_delete on public.product_option_groups;
create policy product_option_groups_auth_delete
on public.product_option_groups
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
