-- Qerbie / Supabase Schema
-- Version: 005_tables_queues
-- Purpose: Merchant tables (physical service points w/ QR) and queues.
-- Depends on: 001_init, 002_merchants

begin;

-- ────────────────────────────────────────────────────────────
-- ENUMS
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
-- MERCHANT TABLES
-- A physical table, counter seat, or service point inside the
-- merchant's location.  Each table owns a unique QR token that
-- is encoded into a QR code printed and placed at that table.
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_tables (
  id           uuid               primary key default gen_random_uuid(),
  merchant_id  uuid               not null references public.merchants(id) on delete cascade,
  label        text               not null,              -- e.g. "Mesa 1", "Balcão A"
  qr_token     text               not null,              -- short unique token embedded in QR URL
  status       public.table_status not null default 'available',
  capacity     smallint           not null default 1,
  is_active    boolean            not null default true,
  display_order integer           not null default 0,
  created_at   timestamptz        not null default now(),
  updated_at   timestamptz        not null default now(),

  constraint merchant_tables_capacity_chk check (capacity >= 1)
);

-- QR token must be globally unique (customers scan without knowing merchant).
create unique index if not exists merchant_tables_qr_token_ux
  on public.merchant_tables (qr_token);

-- Label unique per merchant.
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
-- A named queue configuration (e.g. "Atendimento geral",
-- "Farmácia", "Triagem").  Restaurant merchants may not use
-- queues; clinics and pharmacies will.
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_queues (
  id              uuid                primary key default gen_random_uuid(),
  merchant_id     uuid                not null references public.merchants(id) on delete cascade,
  name            text                not null,
  status          public.queue_status not null default 'closed',
  is_active       boolean             not null default true,
  avg_service_min smallint,                                  -- estimated avg service time (minutes)
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
-- An individual position in a queue, created when a customer
-- "takes a number".  Customers do NOT authenticate — only
-- merchant staff manage ticket state.
-- ────────────────────────────────────────────────────────────
create table if not exists public.queue_tickets (
  id              uuid                     primary key default gen_random_uuid(),
  merchant_id     uuid                     not null references public.merchants(id) on delete cascade,
  queue_id        uuid                     not null references public.merchant_queues(id) on delete cascade,
  ticket_number   integer                  not null,
  status          public.queue_ticket_status not null default 'waiting',
  customer_name   text,                                      -- optional, self-reported
  called_at       timestamptz,
  served_at       timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz              not null default now(),
  updated_at      timestamptz              not null default now()
);

-- Ticket number unique per queue per day (allows daily reset).
create unique index if not exists queue_tickets_queue_number_day_ux
  on public.queue_tickets (
    queue_id,
    ticket_number,
    (created_at::date)
  );

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

commit;
