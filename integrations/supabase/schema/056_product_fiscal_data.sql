-- Qerbie / Supabase Schema
-- Version: 056_product_fiscal_data
-- Purpose: Store optional product classification/tax metadata supplied by the merchant.
-- Depends on: 004_products

begin;

alter table public.products
  add column if not exists fiscal_data jsonb not null default '{}'::jsonb;

alter table public.products
  drop constraint if exists products_fiscal_data_object_chk;

alter table public.products
  add constraint products_fiscal_data_object_chk
  check (jsonb_typeof(fiscal_data) = 'object');

commit;
