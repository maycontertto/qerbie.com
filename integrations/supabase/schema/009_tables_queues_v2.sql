-- Qerbie / Supabase Schema
-- Version: 009_tables_queues_v2
-- Purpose: Fixed v2 of 005_tables_queues without expression indexes.
--          Includes created_day column for per-day uniqueness.
-- Depends on: 001_init, 002_merchants

begin;

-- ────────────────────────────────────────────────────────────
-- ENUMS (idempotent)
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'table_status' and n.nspname = 'public'
  ) then
    create type public.table_status as enum ('available', 'occupied', 'reserved', 'inactive');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'queue_status' and n.nspname = 'public'
  ) then
    create type public.queue_status as enum ('open', 'paused', 'closed');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'queue_ticket_status' and n.nspname = 'public'
  ) then
    create type public.queue_ticket_status as enum (
      'waiting', 'called', 'serving', 'completed', 'cancelled', 'no_show'
    );
  end if;
end
$$;

-- ────────────────────────────────────────────────────────────
-- Helper: set created_day on insert (UTC)
-- ────────────────────────────────────────────────────────────
create or replace function public.set_created_day_utc()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at = now();
  end if;

  -- Lock daily uniqueness to UTC to avoid timezone ambiguity.
  new.created_day = (new.created_at at time zone 'utc')::date;

  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- MERCHANT TABLES
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_tables (
  id            uuid                primary key default gen_random_uuid(),
  merchant_id   uuid                not null references public.merchants(id) on delete cascade,
  label         text                not null,
  qr_token      text                not null,
  status        public.table_status not null default 'available',
  capacity      smallint            not null default 1,
  is_active     boolean             not null default true,
  display_order integer             not null default 0,
  created_at    timestamptz         not null default now(),
  updated_at    timestamptz         not null default now(),

  constraint merchant_tables_capacity_chk check (capacity >= 1)
);

create unique index if not exists merchant_tables_qr_token_ux
  on public.merchant_tables (qr_token);

create unique index if not exists merchant_tables_merchant_label_ux
  on public.merchant_tables (merchant_id, label);

create index if not exists merchant_tables_merchant_id_ix
  on public.merchant_tables (merchant_id);

create index if not exists merchant_tables_merchant_active_ix
  on public.merchant_tables (merchant_id)
  where is_active = true;

drop trigger if exists set_updated_at on public.merchant_tables;
create trigger set_updated_at
before update on public.merchant_tables
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- MERCHANT QUEUES
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_queues (
  id              uuid                primary key default gen_random_uuid(),
  merchant_id     uuid                not null references public.merchants(id) on delete cascade,
  name            text                not null,
  status          public.queue_status not null default 'closed',
  is_active       boolean             not null default true,
  avg_service_min smallint,
  display_order   integer             not null default 0,
  created_at      timestamptz         not null default now(),
  updated_at      timestamptz         not null default now()
);

create unique index if not exists merchant_queues_merchant_name_ux
  on public.merchant_queues (merchant_id, name);

create index if not exists merchant_queues_merchant_id_ix
  on public.merchant_queues (merchant_id);

drop trigger if exists set_updated_at on public.merchant_queues;
create trigger set_updated_at
before update on public.merchant_queues
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- QUEUE TICKETS
-- ────────────────────────────────────────────────────────────
create table if not exists public.queue_tickets (
  id            uuid                      primary key default gen_random_uuid(),
  merchant_id   uuid                      not null references public.merchants(id) on delete cascade,
  queue_id      uuid                      not null references public.merchant_queues(id) on delete cascade,
  ticket_number integer                   not null,
  status        public.queue_ticket_status not null default 'waiting',
  customer_name text,
  called_at     timestamptz,
  served_at     timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz               not null default now(),
  created_day   date                      not null default (timezone('utc', now())::date),
  updated_at    timestamptz               not null default now()
);

-- Backfill created_day if this table existed previously without it.
update public.queue_tickets
set created_day = (created_at at time zone 'utc')::date
where created_day is null;

-- Daily-unique without expression index.
drop index if exists public.queue_tickets_queue_number_day_ux;
create unique index if not exists queue_tickets_queue_number_day_ux
  on public.queue_tickets (queue_id, ticket_number, created_day);

create index if not exists queue_tickets_merchant_id_ix
  on public.queue_tickets (merchant_id);

create index if not exists queue_tickets_queue_id_ix
  on public.queue_tickets (queue_id);

create index if not exists queue_tickets_queue_waiting_ix
  on public.queue_tickets (queue_id, ticket_number)
  where status = 'waiting';

drop trigger if exists set_updated_at on public.queue_tickets;
create trigger set_updated_at
before update on public.queue_tickets
for each row
execute function public.set_updated_at();

drop trigger if exists set_created_day on public.queue_tickets;
create trigger set_created_day
before insert on public.queue_tickets
for each row
execute function public.set_created_day_utc();

commit;
