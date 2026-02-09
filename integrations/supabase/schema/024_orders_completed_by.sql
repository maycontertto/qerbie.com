-- Qerbie / Supabase Schema
-- Version: 024_orders_completed_by
-- Purpose: Track which authenticated user completed an order (for sales-by-attendant analytics).
-- Depends on: 010_orders_v2

begin;

alter table public.orders
  add column if not exists completed_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_merchant_completed_by_completed_at_ix
  on public.orders (merchant_id, completed_by_user_id, completed_at)
  where status = 'completed';

commit;
