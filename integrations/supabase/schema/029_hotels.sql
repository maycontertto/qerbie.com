-- Qerbie / Supabase Schema
-- Version: 029_hotels
-- Purpose: Basic hotel operations: rooms, rate plans, services, guests, reservations, housekeeping.
-- Depends on: 001_init, 002_merchants

begin;

-- ────────────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'hotel_reservation_status') then
    create type public.hotel_reservation_status as enum (
      'pending',
      'confirmed',
      'checked_in',
      'checked_out',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'housekeeping_task_status') then
    create type public.housekeeping_task_status as enum ('open', 'in_progress', 'done', 'cancelled');
  end if;
end
$$;

-- ────────────────────────────────────────────────────────────
-- Room types ("Quartos")
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_hotel_room_types (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  name          text not null,
  description   text,
  capacity      integer not null default 1,
  base_price    numeric(12,2) not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint merchant_hotel_room_types_capacity_chk check (capacity >= 1),
  constraint merchant_hotel_room_types_base_price_chk check (base_price >= 0)
);

create index if not exists merchant_hotel_room_types_merchant_id_ix
  on public.merchant_hotel_room_types (merchant_id);

drop trigger if exists set_updated_at on public.merchant_hotel_room_types;
create trigger set_updated_at
before update on public.merchant_hotel_room_types
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Rate plans ("Planos")
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_hotel_rate_plans (
  id                 uuid primary key default gen_random_uuid(),
  merchant_id        uuid not null references public.merchants(id) on delete cascade,
  name               text not null,
  description        text,
  includes_breakfast boolean not null default false,
  nightly_price      numeric(12,2) not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint merchant_hotel_rate_plans_nightly_price_chk check (nightly_price >= 0)
);

create index if not exists merchant_hotel_rate_plans_merchant_id_ix
  on public.merchant_hotel_rate_plans (merchant_id);

drop trigger if exists set_updated_at on public.merchant_hotel_rate_plans;
create trigger set_updated_at
before update on public.merchant_hotel_rate_plans
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Services ("Serviços")
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_hotel_services (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name        text not null,
  description text,
  price       numeric(12,2),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint merchant_hotel_services_price_chk check (price is null or price >= 0)
);

create index if not exists merchant_hotel_services_merchant_id_ix
  on public.merchant_hotel_services (merchant_id);

drop trigger if exists set_updated_at on public.merchant_hotel_services;
create trigger set_updated_at
before update on public.merchant_hotel_services
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Guests ("Hóspedes")
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_hotel_guests (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  full_name   text not null,
  phone       text,
  email       text,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists merchant_hotel_guests_merchant_id_ix
  on public.merchant_hotel_guests (merchant_id);

drop trigger if exists set_updated_at on public.merchant_hotel_guests;
create trigger set_updated_at
before update on public.merchant_hotel_guests
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Reservations ("Reservas")
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_hotel_reservations (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  guest_id      uuid not null references public.merchant_hotel_guests(id) on delete restrict,
  room_type_id  uuid not null references public.merchant_hotel_room_types(id) on delete restrict,
  rate_plan_id  uuid references public.merchant_hotel_rate_plans(id) on delete set null,
  check_in_date date not null,
  check_out_date date not null,
  status        public.hotel_reservation_status not null default 'pending',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint merchant_hotel_reservations_date_chk check (check_out_date > check_in_date)
);

create index if not exists merchant_hotel_reservations_merchant_id_ix
  on public.merchant_hotel_reservations (merchant_id);
create index if not exists merchant_hotel_reservations_guest_id_ix
  on public.merchant_hotel_reservations (guest_id);
create index if not exists merchant_hotel_reservations_room_type_id_ix
  on public.merchant_hotel_reservations (room_type_id);
create index if not exists merchant_hotel_reservations_checkin_ix
  on public.merchant_hotel_reservations (merchant_id, check_in_date);

drop trigger if exists set_updated_at on public.merchant_hotel_reservations;
create trigger set_updated_at
before update on public.merchant_hotel_reservations
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- Housekeeping tasks
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_hotel_housekeeping_tasks (
  id             uuid primary key default gen_random_uuid(),
  merchant_id    uuid not null references public.merchants(id) on delete cascade,
  reservation_id uuid references public.merchant_hotel_reservations(id) on delete set null,
  title          text not null,
  due_date       date,
  status         public.housekeeping_task_status not null default 'open',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists merchant_hotel_housekeeping_tasks_merchant_id_ix
  on public.merchant_hotel_housekeeping_tasks (merchant_id);

drop trigger if exists set_updated_at on public.merchant_hotel_housekeeping_tasks;
create trigger set_updated_at
before update on public.merchant_hotel_housekeeping_tasks
for each row
execute function public.set_updated_at();

commit;
