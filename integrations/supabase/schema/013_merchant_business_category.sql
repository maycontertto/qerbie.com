-- Qerbie / Supabase Schema
-- Version: 013_merchant_business_category
-- Purpose: Store merchant business category (vertical) to drive dashboard/modules.

begin;

alter table public.merchants
  add column if not exists business_category text;

-- Keep it flexible for future verticals; just enforce sane length.
alter table public.merchants
  drop constraint if exists merchants_business_category_len_chk;

alter table public.merchants
  add constraint merchants_business_category_len_chk
  check (business_category is null or (char_length(business_category) >= 2 and char_length(business_category) <= 64));

create index if not exists merchants_business_category_ix
  on public.merchants (business_category);

commit;
