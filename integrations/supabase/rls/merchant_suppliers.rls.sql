-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_suppliers

begin;

alter table public.merchant_suppliers enable row level security;
alter table public.merchant_suppliers force row level security;

revoke all on table public.merchant_suppliers from anon;
revoke all on table public.merchant_suppliers from authenticated;

grant select, insert, update, delete on table public.merchant_suppliers to authenticated;

drop policy if exists merchant_suppliers_auth_select on public.merchant_suppliers;
create policy merchant_suppliers_auth_select
on public.merchant_suppliers
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_suppliers_auth_insert on public.merchant_suppliers;
create policy merchant_suppliers_auth_insert
on public.merchant_suppliers
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_suppliers_auth_update on public.merchant_suppliers;
create policy merchant_suppliers_auth_update
on public.merchant_suppliers
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists merchant_suppliers_auth_delete on public.merchant_suppliers;
create policy merchant_suppliers_auth_delete
on public.merchant_suppliers
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
