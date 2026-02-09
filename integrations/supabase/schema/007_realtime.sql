-- Qerbie / Supabase Schema
-- Version: 007_realtime
-- Purpose: Enable Supabase Realtime publications on tables that
--          require live updates.  RLS still applies to Realtime
--          subscriptions — clients only receive rows they can see.
-- Depends on: 005_tables_queues, 006_orders
--
-- ═══════════════════════════════════════════════════════════════
-- HOW SUPABASE REALTIME WORKS
-- ═══════════════════════════════════════════════════════════════
--
-- Supabase Realtime uses PostgreSQL logical replication via a
-- publication named "supabase_realtime".  Adding a table to this
-- publication causes INSERT/UPDATE/DELETE events to be broadcast
-- to connected clients.
--
-- IMPORTANT: RLS policies are enforced on Realtime channels.
-- A client only receives events for rows it is allowed to SELECT.
-- This means:
--   • Authenticated staff see only their merchant's data.
--   • Anon customers see only what their RLS policy permits
--     (e.g. their own orders via session_token, active tickets).
--
-- STRATEGY
-- ═══════════════════════════════════════════════════════════════
--
-- Table              │ Events        │ Use case
-- ───────────────────┼───────────────┼─────────────────────────────
-- orders             │ INSERT,UPDATE │ Kitchen display, customer
--                    │               │ order tracking (status changes)
-- order_items        │ INSERT        │ Kitchen display (new items)
-- merchant_tables    │ UPDATE        │ Floor map — table status
--                    │               │ (available ↔ occupied)
-- queue_tickets      │ INSERT,UPDATE │ Queue display board,
--                    │               │ customer position tracking
-- merchant_queues    │ UPDATE        │ Queue status changes
--                    │               │ (open/paused/closed)
--
-- Tables NOT published (no real-time need):
--   merchants, merchant_members, menus, menu_categories,
--   products, product_option_groups, product_options,
--   order_item_options
--
-- ═══════════════════════════════════════════════════════════════

begin;

-- Drop all tables from the publication first to make this
-- script idempotent (re-runnable without errors).
-- Supabase creates the publication automatically; we only
-- manage its membership.

-- Remove existing tables (ignore errors if not present).
do $$
begin
  -- Reset publication to empty set.
  alter publication supabase_realtime set table;
exception
  when undefined_object then
    -- Publication does not exist yet (fresh project).
    create publication supabase_realtime;
end
$$;

-- Add tables that require realtime events.
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.merchant_tables;
alter publication supabase_realtime add table public.queue_tickets;
alter publication supabase_realtime add table public.merchant_queues;

commit;
