-- Qerbie / Supabase Schema
-- Version: 032_hotel_services_stock
-- Purpose: Optional stock tracking for hotel services (merchant_hotel_services).
-- Depends on: 029_hotels

begin;

alter table public.merchant_hotel_services
  add column if not exists track_stock boolean not null default false;

alter table public.merchant_hotel_services
  add column if not exists stock_quantity integer not null default 0;

create index if not exists merchant_hotel_services_merchant_track_stock_ix
  on public.merchant_hotel_services (merchant_id)
  where track_stock = true;

commit;
