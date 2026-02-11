-- Qerbie / Supabase Schema
-- Version: 035_barbearias
-- Purpose: Vertical Barbearia (serviços + QR portal) + vínculos opcionais em fila/agenda.

begin;

-- ────────────────────────────────────────────────────────────
-- BARBERSHOP SERVICES
-- ────────────────────────────────────────────────────────────
create table if not exists public.barbershop_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0,
  duration_min integer not null default 30,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbershop_services_name_len_chk check (char_length(name) >= 2 and char_length(name) <= 120),
  constraint barbershop_services_price_cents_chk check (price_cents >= 0),
  constraint barbershop_services_duration_min_chk check (duration_min >= 5 and duration_min <= 24 * 60)
);

create index if not exists barbershop_services_merchant_id_ix
  on public.barbershop_services (merchant_id);

drop trigger if exists set_updated_at on public.barbershop_services;
create trigger set_updated_at
before update on public.barbershop_services
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- BARBERSHOP QR TOKENS
-- ────────────────────────────────────────────────────────────
create table if not exists public.barbershop_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  label text not null default 'Barbearia',
  qr_token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint barbershop_qr_tokens_label_len_chk check (char_length(label) >= 1 and char_length(label) <= 80)
);

create index if not exists barbershop_qr_tokens_merchant_id_ix
  on public.barbershop_qr_tokens (merchant_id);

-- ────────────────────────────────────────────────────────────
-- OPTIONAL LINKS (service selection)
-- ───────────────────────────────────────────────────────────-
alter table public.queue_tickets
  add column if not exists service_id uuid references public.barbershop_services(id) on delete set null;

create index if not exists queue_tickets_service_id_ix
  on public.queue_tickets (service_id);

alter table public.merchant_appointment_requests
  add column if not exists service_id uuid references public.barbershop_services(id) on delete set null;

create index if not exists merchant_appointment_requests_service_id_ix
  on public.merchant_appointment_requests (service_id);

commit;
