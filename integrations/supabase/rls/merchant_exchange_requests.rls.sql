-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_exchange_requests

begin;

alter table public.merchant_exchange_requests enable row level security;
alter table public.merchant_exchange_requests force row level security;

revoke all on table public.merchant_exchange_requests from anon;
revoke all on table public.merchant_exchange_requests from authenticated;

grant select, insert, update, delete on table public.merchant_exchange_requests to authenticated;

drop policy if exists merchant_exchange_requests_auth_select on public.merchant_exchange_requests;
create policy merchant_exchange_requests_auth_select
on public.merchant_exchange_requests
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_exchange_requests_auth_insert on public.merchant_exchange_requests;
create policy merchant_exchange_requests_auth_insert
on public.merchant_exchange_requests
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_exchange_requests_auth_update on public.merchant_exchange_requests;
create policy merchant_exchange_requests_auth_update
on public.merchant_exchange_requests
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_exchange_requests_auth_delete on public.merchant_exchange_requests;
create policy merchant_exchange_requests_auth_delete
on public.merchant_exchange_requests
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
