-- Qerbie / Supabase Schema
-- Version: 041_orders_payment_method
-- Purpose: Store payment method used for a completed order (e.g. Caixa / POS).
-- Depends on: 010_orders_v2, 024_orders_completed_by

begin;

alter table public.orders
  add column if not exists payment_method text;

alter table public.orders
  add column if not exists payment_notes text;

create index if not exists orders_merchant_payment_method_ix
  on public.orders (merchant_id, payment_method)
  where status = 'completed';

commit;
