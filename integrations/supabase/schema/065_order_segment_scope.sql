-- Isolate orders and exchange records by the merchant's active business segment.
-- Historical orders with a single-segment product line retain that segment;
-- ambiguous and product-less orders inherit the merchant's current segment.

begin;

alter table public.orders add column if not exists business_category text;
alter table public.merchant_exchange_requests add column if not exists business_category text;

with order_product_segments as (
  select oi.order_id, p.business_category
  from public.order_items oi
  join public.products p on p.id = oi.product_id and p.merchant_id = oi.merchant_id
  where p.business_category is not null
), single_segment_orders as (
  select order_id, min(business_category) as business_category
  from order_product_segments
  group by order_id
  having count(distinct business_category) = 1
)
update public.orders o
set business_category = coalesce(
  (select s.business_category from single_segment_orders s where s.order_id = o.id),
  m.business_category,
  'mercado'
)
from public.merchants m
where m.id = o.merchant_id and o.business_category is null;

update public.merchant_exchange_requests r
set business_category = coalesce(
  (select o.business_category from public.orders o where o.id = r.order_id and o.merchant_id = r.merchant_id),
  m.business_category,
  'mercado'
)
from public.merchants m
where m.id = r.merchant_id and r.business_category is null;

alter table public.orders alter column business_category set not null;
alter table public.merchant_exchange_requests alter column business_category set not null;

create index if not exists orders_merchant_segment_created_ix
  on public.orders (merchant_id, business_category, created_at desc);
create index if not exists exchange_requests_merchant_segment_created_ix
  on public.merchant_exchange_requests (merchant_id, business_category, created_at desc);

create or replace function public.assign_order_business_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  merchant_category text;
begin
  if tg_op = 'UPDATE' and new.merchant_id is distinct from old.merchant_id then
    raise exception 'order_merchant_immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.business_category is distinct from old.business_category then
    raise exception 'order_segment_immutable' using errcode = '23514';
  end if;

  select business_category into merchant_category
  from public.merchants where id = new.merchant_id;
  if merchant_category is null then merchant_category := 'mercado'; end if;

  if tg_op = 'INSERT' then
    new.business_category := merchant_category;
  elsif new.business_category is distinct from old.business_category then
    raise exception 'order_segment_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.assign_exchange_business_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_merchant uuid;
  source_category text;
begin
  if tg_op = 'UPDATE' and new.merchant_id is distinct from old.merchant_id then
    raise exception 'exchange_merchant_immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.business_category is distinct from old.business_category then
    raise exception 'exchange_segment_immutable' using errcode = '23514';
  end if;

  if new.order_id is not null then
    select merchant_id, business_category into source_merchant, source_category
    from public.orders where id = new.order_id;
    if source_merchant is null or source_merchant <> new.merchant_id then
      raise exception 'exchange_order_merchant_mismatch' using errcode = '23514';
    end if;
  else
    select business_category into source_category
    from public.merchants where id = new.merchant_id;
    if not found then raise exception 'exchange_merchant_not_found' using errcode = '23503'; end if;
  end if;

  new.business_category := coalesce(source_category, 'mercado');
  return new;
end;
$$;

drop trigger if exists assign_order_business_category on public.orders;
create trigger assign_order_business_category
before insert or update of merchant_id, business_category on public.orders
for each row execute function public.assign_order_business_category();

drop trigger if exists assign_exchange_business_category on public.merchant_exchange_requests;
create trigger assign_exchange_business_category
before insert or update of merchant_id, order_id, business_category on public.merchant_exchange_requests
for each row execute function public.assign_exchange_business_category();

revoke all on function public.assign_order_business_category() from public;
revoke all on function public.assign_exchange_business_category() from public;

commit;
