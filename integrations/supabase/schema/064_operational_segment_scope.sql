-- Separate shared queues and appointment records by business category.
-- Existing rows are retained and assigned using their linked service/mapping;
-- unclassified rows inherit the merchant's current business category.

begin;

alter table public.merchant_queues add column if not exists business_category text;
alter table public.queue_tickets add column if not exists business_category text;
alter table public.merchant_appointment_slots add column if not exists business_category text;
alter table public.merchant_appointment_requests add column if not exists business_category text;

-- Infer a queue's vertical from its service mappings. If history is ambiguous,
-- keep the queue under the merchant's currently selected vertical.
with queue_claims as (
  select queue_id, 'salao_de_beleza'::text as category from public.beauty_queue_services
  union all select queue_id, 'clinica_estetica' from public.aesthetic_queue_services
  union all select queue_id, 'pet_shop' from public.pet_queue_services
  union all select queue_id, 'lava_jato' from public.carwash_queue_services
), claim_summary as (
  select queue_id, min(category) as category
  from queue_claims group by queue_id having count(distinct category) = 1
)
update public.merchant_queues q
set business_category = coalesce(
  (select c.category from claim_summary c where c.queue_id = q.id),
  m.business_category,
  'mercado'
)
from public.merchants m
where m.id = q.merchant_id and q.business_category is null;

update public.queue_tickets t
set business_category = coalesce(
  case when t.carwash_service_id is not null then 'lava_jato'
       when t.pet_service_id is not null then 'pet_shop'
       when t.beauty_service_id is not null then 'salao_de_beleza'
       when t.aesthetic_service_id is not null then 'clinica_estetica'
       when t.service_id is not null then 'barbearia' end,
  q.business_category
)
from public.merchant_queues q
where q.id = t.queue_id and t.business_category is null;

update public.merchant_appointment_slots s
set business_category = coalesce(
  (select q.business_category from public.merchant_queues q where q.id = s.queue_id),
  m.business_category,
  'mercado'
)
from public.merchants m
where m.id = s.merchant_id and s.business_category is null;

update public.merchant_appointment_requests r
set business_category = coalesce(
  case when r.carwash_service_id is not null then 'lava_jato'
       when r.pet_service_id is not null then 'pet_shop'
       when r.beauty_service_id is not null then 'salao_de_beleza'
       when r.aesthetic_service_id is not null then 'clinica_estetica'
       when r.service_id is not null then 'barbearia' end,
  s.business_category,
  m.business_category,
  'mercado'
)
from public.merchant_appointment_slots s, public.merchants m
where s.id = r.slot_id and m.id = r.merchant_id and r.business_category is null;

alter table public.merchant_queues alter column business_category set not null;
alter table public.queue_tickets alter column business_category set not null;
alter table public.merchant_appointment_slots alter column business_category set not null;
alter table public.merchant_appointment_requests alter column business_category set not null;

create index if not exists merchant_queues_segment_ix
  on public.merchant_queues (merchant_id, business_category, is_active, display_order);
create index if not exists queue_tickets_segment_ix
  on public.queue_tickets (merchant_id, business_category, queue_id, status, ticket_number);
create index if not exists appointment_slots_segment_ix
  on public.merchant_appointment_slots (merchant_id, business_category, starts_at);
create index if not exists appointment_requests_segment_ix
  on public.merchant_appointment_requests (merchant_id, business_category, status, created_at);

create or replace function public.assign_operational_segment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_merchant uuid;
  parent_segment text;
begin
  if tg_table_name = 'merchant_queues' then
    select business_category into parent_segment from public.merchants where id = new.merchant_id;
    if parent_segment is null then raise exception 'merchant_segment_required'; end if;
    new.business_category := parent_segment;
  elsif tg_table_name = 'queue_tickets' then
    select merchant_id, business_category into parent_merchant, parent_segment
      from public.merchant_queues where id = new.queue_id;
    if parent_merchant is null or parent_merchant <> new.merchant_id then raise exception 'queue_merchant_mismatch'; end if;
    new.business_category := parent_segment;
  elsif tg_table_name = 'merchant_appointment_slots' then
    if new.queue_id is not null then
      select merchant_id, business_category into parent_merchant, parent_segment
        from public.merchant_queues where id = new.queue_id;
      if parent_merchant is null or parent_merchant <> new.merchant_id then raise exception 'queue_merchant_mismatch'; end if;
    end if;
    if parent_segment is null then
      select business_category into parent_segment from public.merchants where id = new.merchant_id;
    end if;
    if parent_segment is null then raise exception 'merchant_segment_required'; end if;
    new.business_category := parent_segment;
  elsif tg_table_name = 'merchant_appointment_requests' then
    select merchant_id, business_category into parent_merchant, parent_segment
      from public.merchant_appointment_slots where id = new.slot_id;
    if parent_merchant is null or parent_merchant <> new.merchant_id then raise exception 'slot_merchant_mismatch'; end if;
    new.business_category := parent_segment;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_operational_segment on public.merchant_queues;
create trigger assign_operational_segment before insert or update of merchant_id, business_category on public.merchant_queues
for each row execute function public.assign_operational_segment();
drop trigger if exists assign_operational_segment on public.queue_tickets;
create trigger assign_operational_segment before insert or update of merchant_id, queue_id, business_category on public.queue_tickets
for each row execute function public.assign_operational_segment();
drop trigger if exists assign_operational_segment on public.merchant_appointment_slots;
create trigger assign_operational_segment before insert or update of merchant_id, queue_id, business_category on public.merchant_appointment_slots
for each row execute function public.assign_operational_segment();
drop trigger if exists zz_assign_operational_segment on public.merchant_appointment_requests;
create trigger zz_assign_operational_segment before insert or update of merchant_id, slot_id, business_category on public.merchant_appointment_requests
for each row execute function public.assign_operational_segment();

revoke all on function public.assign_operational_segment() from public;

commit;
