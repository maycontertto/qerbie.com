-- Qerbie / Supabase Schema
-- Version: 044_units_and_decimal_quantities
-- Purpose: Add unit label to products and allow decimal quantities (weight/measure) for stock and POS.
-- Depends on: 010_orders_v2, 028_stock, 031_stock_auto_deduct

begin;

-- Unit label for selling (ex: un, kg, m, m², m³, L)
alter table if exists public.products
  add column if not exists unit_label text not null default 'un';

-- Stock quantity: allow decimals for weight/measure.
do $$
declare
  t text;
begin
  select c.data_type
    into t
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'products'
     and c.column_name = 'stock_quantity';

  if t = 'integer' then
    alter table public.products
      alter column stock_quantity type numeric(12,3)
      using stock_quantity::numeric;
  end if;
end
$$;

-- Order item quantity: allow decimals (ex: 0.5 kg).
do $$
declare
  t text;
begin
  select c.data_type
    into t
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'order_items'
     and c.column_name = 'quantity';

  if t = 'integer' then
    alter table public.order_items
      alter column quantity type numeric(12,3)
      using quantity::numeric;
  end if;
end
$$;

alter table if exists public.order_items
  alter column quantity set default 1;

alter table if exists public.order_items
  drop constraint if exists order_items_quantity_gte_one_chk;

alter table if exists public.order_items
  add constraint order_items_quantity_gt_zero_chk check (quantity > 0);

-- Keep stock auto-deduct working with decimals.
create or replace function public.decrement_product_stock_from_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set stock_quantity = stock_quantity - new.quantity
   where id = new.product_id
     and merchant_id = new.merchant_id
     and track_stock = true;

  return new;
end;
$$;

commit;
