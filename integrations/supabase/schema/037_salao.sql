-- Qerbie / Supabase Schema
-- Version: 037_salao
-- Purpose: Vertical Salão de Beleza (serviços + QR portal) + vínculos opcionais em fila/agenda + profissionais (via filas).

begin;

-- ────────────────────────────────────────────────────────────
-- BEAUTY SERVICES (serviços do salão)
-- ────────────────────────────────────────────────────────────
create table if not exists public.beauty_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  description text,
  notes text,
  price_cents integer not null default 0,
  duration_min integer not null default 30,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint beauty_services_name_len_chk check (char_length(name) >= 2 and char_length(name) <= 120),
  constraint beauty_services_price_cents_chk check (price_cents >= 0),
  constraint beauty_services_duration_min_chk check (duration_min >= 5 and duration_min <= 24 * 60)
);

create index if not exists beauty_services_merchant_id_ix
  on public.beauty_services (merchant_id);

drop trigger if exists set_updated_at on public.beauty_services;
create trigger set_updated_at
before update on public.beauty_services
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- BEAUTY QR TOKENS
-- ────────────────────────────────────────────────────────────
create table if not exists public.beauty_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  label text not null default 'Salão de Beleza',
  qr_token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint beauty_qr_tokens_label_len_chk check (char_length(label) >= 1 and char_length(label) <= 80)
);

create index if not exists beauty_qr_tokens_merchant_id_ix
  on public.beauty_qr_tokens (merchant_id);

-- ────────────────────────────────────────────────────────────
-- PROFESSIONALS (via queues) x SERVICES
-- Each professional/specialty is modeled as a queue (merchant_queues).
-- This table tells which queues can perform each service.
-- ────────────────────────────────────────────────────────────
create table if not exists public.beauty_queue_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  queue_id uuid not null references public.merchant_queues(id) on delete cascade,
  service_id uuid not null references public.beauty_services(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint beauty_queue_services_unique unique (queue_id, service_id)
);

create index if not exists beauty_queue_services_merchant_ix
  on public.beauty_queue_services (merchant_id);

create index if not exists beauty_queue_services_queue_ix
  on public.beauty_queue_services (queue_id);

create index if not exists beauty_queue_services_service_ix
  on public.beauty_queue_services (service_id);

create or replace function public.enforce_beauty_queue_services_merchant_consistency()
returns trigger
language plpgsql
as $$
declare
  q_merchant uuid;
  s_merchant uuid;
begin
  select mq.merchant_id into q_merchant
  from public.merchant_queues mq
  where mq.id = new.queue_id;

  if q_merchant is null then
    raise exception 'Invalid queue_id';
  end if;

  select s.merchant_id into s_merchant
  from public.beauty_services s
  where s.id = new.service_id;

  if s_merchant is null then
    raise exception 'Invalid service_id';
  end if;

  if new.merchant_id <> q_merchant or new.merchant_id <> s_merchant then
    raise exception 'merchant_id mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists beauty_queue_services_merchant_consistency on public.beauty_queue_services;
create trigger beauty_queue_services_merchant_consistency
before insert or update on public.beauty_queue_services
for each row
execute function public.enforce_beauty_queue_services_merchant_consistency();

-- ────────────────────────────────────────────────────────────
-- OPTIONAL LINKS (service selection)
-- ───────────────────────────────────────────────────────────-
alter table public.queue_tickets
  add column if not exists beauty_service_id uuid references public.beauty_services(id) on delete set null;

create index if not exists queue_tickets_beauty_service_id_ix
  on public.queue_tickets (beauty_service_id);

alter table public.merchant_appointment_requests
  add column if not exists beauty_service_id uuid references public.beauty_services(id) on delete set null;

create index if not exists merchant_appointment_requests_beauty_service_id_ix
  on public.merchant_appointment_requests (beauty_service_id);

commit;
