-- Qerbie / Supabase Schema
-- Version: 008_day_indexes_fix
-- Purpose: Fix expression indexes using (created_at::date) which fails
--          because timestamptz->date is STABLE (timezone-dependent), not IMMUTABLE.
--
-- This migration adds explicit created_day columns and recreates the
-- unique-per-day indexes using those columns.
--
-- Affected:
--   - public.queue_tickets
--   - public.orders

begin;

-- ────────────────────────────────────────────────────────────
-- Helper: set created_day on insert
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
-- queue_tickets
-- ────────────────────────────────────────────────────────────
alter table public.queue_tickets
  add column if not exists created_day date;

update public.queue_tickets
set created_day = (created_at at time zone 'utc')::date
where created_day is null;

alter table public.queue_tickets
  alter column created_day set default (timezone('utc', now())::date);

alter table public.queue_tickets
  alter column created_day set not null;

drop trigger if exists set_created_day on public.queue_tickets;
create trigger set_created_day
before insert on public.queue_tickets
for each row
execute function public.set_created_day_utc();

drop index if exists public.queue_tickets_queue_number_day_ux;
create unique index if not exists queue_tickets_queue_number_day_ux
  on public.queue_tickets (queue_id, ticket_number, created_day);

-- ────────────────────────────────────────────────────────────
-- orders
-- ────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists created_day date;

update public.orders
set created_day = (created_at at time zone 'utc')::date
where created_day is null;

alter table public.orders
  alter column created_day set default (timezone('utc', now())::date);

alter table public.orders
  alter column created_day set not null;

drop trigger if exists set_created_day on public.orders;
create trigger set_created_day
before insert on public.orders
for each row
execute function public.set_created_day_utc();

drop index if exists public.orders_merchant_number_day_ux;
create unique index if not exists orders_merchant_number_day_ux
  on public.orders (merchant_id, order_number, created_day);

commit;
