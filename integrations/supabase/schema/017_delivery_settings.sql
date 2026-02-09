-- 017_delivery_settings.sql
-- Entrega: habilitar/desabilitar, taxa fixa opcional, observação ao cliente e ETA.

alter table public.merchants
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists delivery_fee numeric(12,2),
  add column if not exists delivery_note text,
  add column if not exists delivery_eta_minutes integer;

alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists delivery_fee numeric(12,2),
  add column if not exists delivery_eta_minutes integer;
