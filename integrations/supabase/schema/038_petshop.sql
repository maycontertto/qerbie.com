-- Qerbie / Supabase Schema
-- Version: 038_petshop
-- Purpose: Vertical Pet Shop / Clínica Veterinária (serviços + QR portal) + vínculos opcionais em fila/agenda + profissionais (via filas) + histórico leve do pet.

begin;

-- ────────────────────────────────────────────────────────────
-- PET SERVICES
-- ────────────────────────────────────────────────────────────
create table if not exists public.pet_services (
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
  constraint pet_services_name_len_chk check (char_length(name) >= 2 and char_length(name) <= 120),
  constraint pet_services_price_cents_chk check (price_cents >= 0),
  constraint pet_services_duration_min_chk check (duration_min >= 5 and duration_min <= 24 * 60)
);

create index if not exists pet_services_merchant_id_ix
  on public.pet_services (merchant_id);

drop trigger if exists set_updated_at on public.pet_services;
create trigger set_updated_at
before update on public.pet_services
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PET QR TOKENS
-- ────────────────────────────────────────────────────────────
create table if not exists public.pet_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  label text not null default 'Pet Shop',
  qr_token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pet_qr_tokens_label_len_chk check (char_length(label) >= 1 and char_length(label) <= 80)
);

create index if not exists pet_qr_tokens_merchant_id_ix
  on public.pet_qr_tokens (merchant_id);

-- ────────────────────────────────────────────────────────────
-- PROFESSIONALS (via queues) x SERVICES
-- Each professional/specialty is modeled as a queue (merchant_queues).
-- This table tells which queues can perform each service.
-- ────────────────────────────────────────────────────────────
create table if not exists public.pet_queue_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  queue_id uuid not null references public.merchant_queues(id) on delete cascade,
  service_id uuid not null references public.pet_services(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint pet_queue_services_unique unique (queue_id, service_id)
);

create index if not exists pet_queue_services_merchant_ix
  on public.pet_queue_services (merchant_id);

create index if not exists pet_queue_services_queue_ix
  on public.pet_queue_services (queue_id);

create index if not exists pet_queue_services_service_ix
  on public.pet_queue_services (service_id);

create or replace function public.enforce_pet_queue_services_merchant_consistency()
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
  from public.pet_services s
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

drop trigger if exists pet_queue_services_merchant_consistency on public.pet_queue_services;
create trigger pet_queue_services_merchant_consistency
before insert or update on public.pet_queue_services
for each row
execute function public.enforce_pet_queue_services_merchant_consistency();

-- ────────────────────────────────────────────────────────────
-- PET PROFILES (light operational history/preferences)
-- ────────────────────────────────────────────────────────────
create table if not exists public.pet_profiles (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  pet_name text not null,
  owner_name text,
  owner_contact text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_profiles_pet_name_len_chk check (char_length(pet_name) >= 2 and char_length(pet_name) <= 80)
);

create index if not exists pet_profiles_merchant_id_ix
  on public.pet_profiles (merchant_id);

create index if not exists pet_profiles_pet_name_ix
  on public.pet_profiles (pet_name);

drop trigger if exists set_updated_at on public.pet_profiles;
create trigger set_updated_at
before update on public.pet_profiles
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- OPTIONAL LINKS (service selection + pet name)
-- ───────────────────────────────────────────────────────────-
alter table public.queue_tickets
  add column if not exists pet_service_id uuid references public.pet_services(id) on delete set null;

alter table public.queue_tickets
  add column if not exists pet_name text;

create index if not exists queue_tickets_pet_service_id_ix
  on public.queue_tickets (pet_service_id);

create index if not exists queue_tickets_pet_name_ix
  on public.queue_tickets (pet_name);

alter table public.merchant_appointment_requests
  add column if not exists pet_service_id uuid references public.pet_services(id) on delete set null;

alter table public.merchant_appointment_requests
  add column if not exists pet_name text;

create index if not exists merchant_appointment_requests_pet_service_id_ix
  on public.merchant_appointment_requests (pet_service_id);

create index if not exists merchant_appointment_requests_pet_name_ix
  on public.merchant_appointment_requests (pet_name);

commit;
