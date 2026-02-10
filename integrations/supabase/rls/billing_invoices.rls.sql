-- Qerbie / Supabase RLS Policies
-- Table: public.billing_invoices

begin;

alter table public.billing_invoices enable row level security;
alter table public.billing_invoices force row level security;

revoke all on table public.billing_invoices from anon;
revoke all on table public.billing_invoices from authenticated;

-- Authenticated users can read invoices for their merchant.
grant select on table public.billing_invoices to authenticated;
-- Owner can request (insert) a new invoice.
grant insert on table public.billing_invoices to authenticated;

drop policy if exists billing_invoices_auth_select on public.billing_invoices;
create policy billing_invoices_auth_select
on public.billing_invoices
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists billing_invoices_auth_insert on public.billing_invoices;
create policy billing_invoices_auth_insert
on public.billing_invoices
for insert
to authenticated
with check (public.is_merchant_owner(merchant_id));

commit;
