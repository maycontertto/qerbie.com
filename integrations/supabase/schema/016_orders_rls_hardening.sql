-- Qerbie / Supabase Schema
-- Version: 016_orders_rls_hardening
-- Purpose: Harden anon insert for orders to bind session_token to request header
--          and ensure table_id belongs to merchant_id.
-- Depends on: 010_orders_v2, existing RLS files

begin;

-- ORDERS: anon insert must be tied to session
-- Keep the same policy name, so re-running is safe.
drop policy if exists orders_anon_insert on public.orders;
create policy orders_anon_insert
on public.orders
for insert
to anon
with check (
  status = 'pending'
  and session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
  and (
    table_id is null
    or merchant_id = (
      select mt.merchant_id
      from public.merchant_tables mt
      where mt.id = table_id
    )
  )
);

commit;
