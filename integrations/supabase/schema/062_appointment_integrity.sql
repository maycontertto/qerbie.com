-- Qerbie / Schema 062: prevent double booking and keep cancelled bookings in sync.
begin;

create or replace function public.prevent_overlapping_appointment_slots()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.queue_id is not null and not exists (
    select 1 from public.merchant_queues q
    where q.id = new.queue_id and q.merchant_id = new.merchant_id and q.is_active
  ) then
    raise exception 'invalid_appointment_queue' using errcode = 'P0001';
  end if;

  if new.is_active and new.status <> 'cancelled' then
    -- Serialize availability checks for this professional (or the unassigned schedule).
    perform pg_advisory_xact_lock(hashtextextended(
      new.merchant_id::text || ':' || coalesce(new.queue_id::text, 'unassigned'), 0
    ));

    if exists (
      select 1
      from public.merchant_appointment_slots s
      where s.merchant_id = new.merchant_id
        and s.queue_id is not distinct from new.queue_id
        and s.id <> new.id
        and s.is_active
        and s.status <> 'cancelled'
        and tstzrange(s.starts_at, s.ends_at, '[)')
            && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'appointment_overlap' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_overlapping_appointment_slots on public.merchant_appointment_slots;
create trigger prevent_overlapping_appointment_slots
before insert or update of merchant_id, queue_id, starts_at, ends_at, status, is_active
on public.merchant_appointment_slots
for each row execute function public.prevent_overlapping_appointment_slots();

-- A cancelled/inactive slot must never be reopened by the request status trigger.
create or replace function public.handle_appointment_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'confirmed' then
    update public.merchant_appointment_slots
      set status = 'booked', updated_at = now()
      where id = new.slot_id and is_active;
    return new;
  end if;
  if new.status in ('declined', 'cancelled') then
    update public.merchant_appointment_slots
      set status = 'available', updated_at = now()
      where id = new.slot_id and status = 'pending' and is_active;
  end if;
  return new;
end;
$$;

create or replace function public.cancel_requests_when_slot_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' or not new.is_active then
    update public.merchant_appointment_requests
      set status = 'cancelled', updated_at = now()
      where slot_id = new.id
        and merchant_id = new.merchant_id
        and status in ('pending', 'confirmed');
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_overlapping_appointment_slots() from public;
revoke all on function public.cancel_requests_when_slot_cancelled() from public;
drop trigger if exists cancel_requests_when_slot_cancelled on public.merchant_appointment_slots;
create trigger cancel_requests_when_slot_cancelled
after update of status, is_active on public.merchant_appointment_slots
for each row execute function public.cancel_requests_when_slot_cancelled();

-- Repair requests whose slots had already been explicitly cancelled or disabled.
update public.merchant_appointment_requests r
set status = 'cancelled', updated_at = now()
from public.merchant_appointment_slots s
where s.id = r.slot_id
  and s.merchant_id = r.merchant_id
  and (s.status = 'cancelled' or not s.is_active)
  and r.status in ('pending', 'confirmed');

commit;
