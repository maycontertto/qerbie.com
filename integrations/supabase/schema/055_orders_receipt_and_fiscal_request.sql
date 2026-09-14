-- Qerbie / Supabase Schema
-- Version: 055_orders_receipt_and_fiscal_request
-- Purpose: Preferência de comprovante e identificação opcional do consumidor no PDV.
-- Note: fiscal_requested registra a solicitação; emissão NFC-e exige integração fiscal autorizada.

begin;

alter table public.orders
  add column if not exists receipt_type text not null default 'non_fiscal'
    check (receipt_type in ('non_fiscal', 'fiscal_requested')),
  add column if not exists customer_tax_id text,
  add column if not exists fiscal_status text
    check (fiscal_status is null or fiscal_status in ('requested', 'issued', 'failed'));

create index if not exists orders_merchant_fiscal_status_ix
  on public.orders (merchant_id, fiscal_status, created_at desc)
  where fiscal_status is not null;

commit;