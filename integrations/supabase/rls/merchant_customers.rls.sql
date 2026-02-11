-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_customers

begin;

alter table public.merchant_customers enable row level security;
alter table public.merchant_customers force row level security;

revoke all on table public.merchant_customers from anon;
revoke all on table public.merchant_customers from authenticated;

grant select, insert, update, delete on table public.merchant_customers to authenticated;

drop policy if exists merchant_customers_auth_select on public.merchant_customers;
create policy merchant_customers_auth_select
on public.merchant_customers
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_customers_auth_insert on public.merchant_customers;
create policy merchant_customers_auth_insert
on public.merchant_customers
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_customers_auth_update on public.merchant_customers;
create policy merchant_customers_auth_update
on public.merchant_customers
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists merchant_customers_auth_delete on public.merchant_customers;
create policy merchant_customers_auth_delete
on public.merchant_customers
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
