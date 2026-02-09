-- Qerbie / Supabase Schema
-- Version: 028_stock
-- Purpose: Simple stock tracking per product (optional).
-- Depends on: 004_products

begin;

alter table public.products
  add column if not exists track_stock boolean not null default false;

alter table public.products
  add column if not exists stock_quantity integer not null default 0;

create index if not exists products_merchant_track_stock_ix
  on public.products (merchant_id)
  where track_stock = true;

commit;
