-- Qerbie / Supabase Schema
-- Version: 011_realtime_v2
-- Purpose: Supabase Realtime publication membership after v2 tables exist.
-- Depends on: 009_tables_queues_v2, 010_orders_v2

begin;

-- Ensure the publication exists; reset to empty to be idempotent.
do $$
begin
  alter publication supabase_realtime set table;
exception
  when undefined_object then
    create publication supabase_realtime;
end
$$;

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.merchant_tables;
alter publication supabase_realtime add table public.queue_tickets;
alter publication supabase_realtime add table public.merchant_queues;

commit;
