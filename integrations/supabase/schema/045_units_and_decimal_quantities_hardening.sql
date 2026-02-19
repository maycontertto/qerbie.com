-- Qerbie / Supabase Schema
-- Version: 045_units_and_decimal_quantities_hardening
-- Purpose: Harden unit_label defaults/not-null and ensure decimal quantities for legacy integer columns.
-- Depends on: 044_units_and_decimal_quantities

begin;

-- Ensure unit_label exists, has default, and is not null (backfill existing rows).
alter table if exists public.products
  add column if not exists unit_label text;

alter table if exists public.products
  alter column unit_label set default 'un';

update public.products
   set unit_label = 'un'
 where unit_label is null
    or btrim(unit_label) = '';

alter table if exists public.products
  alter column unit_label set not null;

-- Stock quantity: ensure numeric(12,3) for legacy integer types.
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

  if t in ('integer', 'bigint', 'smallint') then
    alter table public.products
      alter column stock_quantity type numeric(12,3)
      using stock_quantity::numeric;
  end if;
end
$$;

-- Order item quantity: ensure numeric(12,3) for legacy integer types.
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

  if t in ('integer', 'bigint', 'smallint') then
    alter table public.order_items
      alter column quantity type numeric(12,3)
      using quantity::numeric;
  end if;
end
$$;

commit;
