-- Qerbie / Supabase RLS Policies
-- Table: public.orders
--
-- Anon customers can:
--   - INSERT an order (place an order without auth)
--   - SELECT their own order(s) via session_token
--
-- Authenticated staff can manage all orders for their merchant.

begin;

alter table public.orders enable row level security;
alter table public.orders force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.orders from anon;
revoke all on table public.orders from authenticated;

grant select, insert on table public.orders to anon;
grant select, insert, update, delete on table public.orders to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customer can read their own orders by session_token.
drop policy if exists orders_anon_select on public.orders;
create policy orders_anon_select
on public.orders
for select
to anon
using (
  session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
);

-- Customer can place an order (status must be 'pending').
drop policy if exists orders_anon_insert on public.orders;
create policy orders_anon_insert
on public.orders
for insert
to anon
with check (
  status = 'pending'
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists orders_auth_select on public.orders;
create policy orders_auth_select
on public.orders
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists orders_auth_insert on public.orders;
create policy orders_auth_insert
on public.orders
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists orders_auth_update on public.orders;
create policy orders_auth_update
on public.orders
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only (e.g. purge old data).
drop policy if exists orders_auth_delete on public.orders;
create policy orders_auth_delete
on public.orders
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
