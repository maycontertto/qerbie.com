-- Keep an appointment request and its slot in sync when staff cancels a slot.
-- This also repairs historical rows left as confirmed after slot cancellation.

begin;

update public.merchant_appointment_requests request
set status = 'cancelled',
    cancelled_at = coalesce(request.cancelled_at, now())
from public.merchant_appointment_slots slot
where slot.id = request.slot_id
  and slot.merchant_id = request.merchant_id
  and slot.business_category = request.business_category
  and slot.status = 'cancelled'
  and request.status in ('pending', 'confirmed');

create or replace function public.cancel_appointment_requests_with_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.merchant_appointment_requests
    set status = 'cancelled',
        cancelled_at = coalesce(cancelled_at, now())
    where slot_id = new.id
      and merchant_id = new.merchant_id
      and business_category = new.business_category
      and status in ('pending', 'confirmed');
  end if;

  return new;
end;
$$;

drop trigger if exists cancel_appointment_requests_with_slot on public.merchant_appointment_slots;
create trigger cancel_appointment_requests_with_slot
after update of status on public.merchant_appointment_slots
for each row
when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
execute function public.cancel_appointment_requests_with_slot();

revoke all on function public.cancel_appointment_requests_with_slot() from public;

commit;
