-- Qerbie / Supabase Schema
-- Version: 012_realtime_v3
-- Purpose: Fix Realtime publication membership with valid PostgreSQL syntax.
-- Depends on: 009_tables_queues_v2, 010_orders_v2
--
-- Notes:
-- - Postgres does NOT allow: ALTER PUBLICATION ... SET TABLE; (empty)
-- - Use SET TABLE <list> to replace membership deterministically.

begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime set table
      public.orders,
      public.order_items,
      public.merchant_tables,
      public.queue_tickets,
      public.merchant_queues;
  else
    create publication supabase_realtime for table
      public.orders,
      public.order_items,
      public.merchant_tables,
      public.queue_tickets,
      public.merchant_queues;
  end if;
end
$$;

commit;
