-- Qerbie / Supabase Schema
-- Version: 042_products_barcode
-- Purpose: Optional barcode/sku field on products.
-- Depends on: products table (004_products and later)

begin;

alter table if exists public.products
  add column if not exists barcode text;

-- Useful for fast lookup / preventing duplicates at app level per merchant.
create index if not exists products_merchant_barcode_ix
  on public.products (merchant_id, barcode)
  where barcode is not null;

commit;
