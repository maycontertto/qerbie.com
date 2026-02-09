-- Qerbie / Supabase Schema
-- Version: 027_agenda
-- Purpose: Clinic scheduling (slots published by merchant; customers request; requires confirmation).
-- Depends on: 001_init, 002_merchants, 005_tables_queues

begin;

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'appointment_slot_status' and n.nspname = 'public'
  ) then
    create type public.appointment_slot_status as enum (
      'available',
      'pending',
      'booked',
      'cancelled'
    );
  end if;
end
$$;


do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'appointment_request_status' and n.nspname = 'public'
  ) then
    create type public.appointment_request_status as enum (
      'pending',
      'confirmed',
      'declined',
      'cancelled'
    );
  end if;
end
$$;

-- ────────────────────────────────────────────────────────────
-- MERCHANT APPOINTMENT SLOTS
-- A published availability window. We tie it to a queue (professional/specialty)
-- since clinics already model each specialist as a queue.
-- ────────────────────────────────────────────────────────────

create table if not exists public.merchant_appointment_slots (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references public.merchants(id) on delete cascade,
  queue_id     uuid references public.merchant_queues(id) on delete set null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       public.appointment_slot_status not null default 'available',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint merchant_appointment_slots_range_chk check (ends_at > starts_at)
);

create index if not exists merchant_appointment_slots_merchant_ix
  on public.merchant_appointment_slots (merchant_id, starts_at);

create index if not exists merchant_appointment_slots_queue_ix
  on public.merchant_appointment_slots (queue_id, starts_at);

create index if not exists merchant_appointment_slots_active_ix
  on public.merchant_appointment_slots (merchant_id, starts_at)
  where is_active = true and status = 'available';

drop trigger if exists set_updated_at on public.merchant_appointment_slots;
create trigger set_updated_at
before update on public.merchant_appointment_slots
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- MERCHANT APPOINTMENT REQUESTS
-- A customer request to book a specific slot (requires confirmation).
-- session_token ties the request to the customer session (anon tracking).
-- We snapshot slot times & queue_id so customers can read status without slot access.
-- ────────────────────────────────────────────────────────────

create table if not exists public.merchant_appointment_requests (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.merchants(id) on delete cascade,
  slot_id         uuid not null references public.merchant_appointment_slots(id) on delete cascade,
  queue_id        uuid references public.merchant_queues(id) on delete set null,
  session_token   text not null,
  customer_name   text,
  customer_contact text,
  customer_notes  text,
  status          public.appointment_request_status not null default 'pending',
  slot_starts_at  timestamptz not null,
  slot_ends_at    timestamptz not null,
  confirmed_at    timestamptz,
  declined_at     timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint merchant_appointment_requests_range_chk check (slot_ends_at > slot_starts_at)
);

create index if not exists merchant_appointment_requests_merchant_status_ix
  on public.merchant_appointment_requests (merchant_id, status, created_at);

create index if not exists merchant_appointment_requests_session_ix
  on public.merchant_appointment_requests (session_token, created_at);

create index if not exists merchant_appointment_requests_slot_ix
  on public.merchant_appointment_requests (slot_id);

drop trigger if exists set_updated_at on public.merchant_appointment_requests;
create trigger set_updated_at
before update on public.merchant_appointment_requests
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- REQUEST INSERT GUARD
-- - Locks slot row
-- - Ensures slot is available & in the future
-- - Copies merchant/queue and slot range into the request
-- - Sets slot status to 'pending'
-- - For anon: binds session_token to x-session-token header
-- ────────────────────────────────────────────────────────────

create or replace function public.handle_appointment_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_row public.merchant_appointment_slots%rowtype;
  current_token text;
  role_name text;
begin
  role_name := coalesce(auth.role(), '');
  current_token := current_setting('request.headers', true)::json ->> 'x-session-token';

  if new.status <> 'pending' then
    raise exception 'invalid_status';
  end if;

  select * into slot_row
  from public.merchant_appointment_slots
  where id = new.slot_id
  for update;

  if not found then
    raise exception 'invalid_slot';
  end if;

  if slot_row.is_active is not true then
    raise exception 'slot_inactive';
  end if;

  if slot_row.status <> 'available' then
    raise exception 'slot_unavailable';
  end if;

  if slot_row.starts_at < now() then
    raise exception 'slot_in_past';
  end if;

  if role_name = 'anon' then
    if current_token is null or current_token = '' then
      raise exception 'missing_session';
    end if;

    new.session_token := coalesce(nullif(new.session_token, ''), current_token);

    if new.session_token <> current_token then
      raise exception 'invalid_session';
    end if;
  end if;

  new.merchant_id := slot_row.merchant_id;
  new.queue_id := slot_row.queue_id;
  new.slot_starts_at := slot_row.starts_at;
  new.slot_ends_at := slot_row.ends_at;

  update public.merchant_appointment_slots
    set status = 'pending', updated_at = now()
    where id = slot_row.id;

  return new;
end;
$$;

revoke all on function public.handle_appointment_request_insert() from public;

drop trigger if exists appointment_request_insert on public.merchant_appointment_requests;
create trigger appointment_request_insert
before insert on public.merchant_appointment_requests
for each row
execute function public.handle_appointment_request_insert();

-- ────────────────────────────────────────────────────────────
-- REQUEST STATUS -> SLOT STATUS SYNC
-- Keeps slot status consistent when staff confirms/declines/cancels.
-- ────────────────────────────────────────────────────────────

create or replace function public.handle_appointment_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status = 'confirmed' then
    update public.merchant_appointment_slots
      set status = 'booked', updated_at = now()
      where id = new.slot_id;
    return new;
  end if;

  if new.status in ('declined', 'cancelled') then
    update public.merchant_appointment_slots
      set status = 'available', updated_at = now()
      where id = new.slot_id
        and status = 'pending';
    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_appointment_request_update() from public;

drop trigger if exists appointment_request_update on public.merchant_appointment_requests;
create trigger appointment_request_update
after update on public.merchant_appointment_requests
for each row
execute function public.handle_appointment_request_update();

commit;
