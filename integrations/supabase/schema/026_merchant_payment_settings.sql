-- Qerbie / Supabase Schema
-- Version: 026_merchant_payment_settings
-- Purpose: Merchant-configurable payment methods (no processing, only instructions for customer).
-- Depends on: 002_merchants

begin;

alter table public.merchants
  add column if not exists payment_pix_key text,
  add column if not exists payment_pix_description text,
  add column if not exists payment_card_url text,
  add column if not exists payment_card_description text,
  add column if not exists payment_cash_description text,
  add column if not exists payment_disclaimer text;

commit;
