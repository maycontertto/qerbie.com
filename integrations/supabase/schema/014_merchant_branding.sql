-- Qerbie / Supabase Schema
-- Version: 014_merchant_branding
-- Purpose: Merchant branding settings shown to customers (QR flow).

begin;

alter table public.merchants
  add column if not exists brand_display_name text,
  add column if not exists brand_logo_url text,
  add column if not exists brand_primary_color text;

-- Constraints (idempotent)
alter table public.merchants
  drop constraint if exists merchants_brand_display_name_len_chk;

alter table public.merchants
  add constraint merchants_brand_display_name_len_chk
  check (brand_display_name is null or (char_length(brand_display_name) >= 2 and char_length(brand_display_name) <= 80));

alter table public.merchants
  drop constraint if exists merchants_brand_logo_url_len_chk;

alter table public.merchants
  add constraint merchants_brand_logo_url_len_chk
  check (brand_logo_url is null or (char_length(brand_logo_url) >= 8 and char_length(brand_logo_url) <= 512));

alter table public.merchants
  drop constraint if exists merchants_brand_primary_color_fmt_chk;

-- Accept #RRGGBB only for now (keeps UI simple)
alter table public.merchants
  add constraint merchants_brand_primary_color_fmt_chk
  check (brand_primary_color is null or brand_primary_color ~ '^#[0-9A-Fa-f]{6}$');

commit;
