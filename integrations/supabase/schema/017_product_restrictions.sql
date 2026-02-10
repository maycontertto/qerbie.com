-- Qerbie / Supabase Schema
-- Version: 017_product_restrictions
-- Purpose: Product-level restrictions (prescription / document).
-- Depends on: products table (004_products and later)

begin;

alter table if exists public.products
  add column if not exists requires_prescription boolean not null default false;

alter table if exists public.products
  add column if not exists requires_document boolean not null default false;

commit;
