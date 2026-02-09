-- Qerbie / Supabase Schema
-- Version: 010_orders_v2
-- Purpose: Fixed v2 of 006_orders without expression indexes.
--          Includes created_day column for per-day uniqueness.
-- Depends on: 001_init, 002_merchants, 004_products, 009_tables_queues_v2

begin;

-- ────────────────────────────────────────────────────────────
-- ENUMS (idempotent)
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'order_status' and n.nspname = 'public'
  ) then
    create type public.order_status as enum (
      'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'order_type' and n.nspname = 'public'
  ) then
    create type public.order_type as enum ('dine_in', 'takeaway', 'delivery');
  end if;
end
$$;

-- Ensure helper exists (in case 009 wasn't run for some reason).
create or replace function public.set_created_day_utc()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null then
    new.created_at = now();
  end if;
  new.created_day = (new.created_at at time zone 'utc')::date;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- ORDERS
-- ────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                  uuid               primary key default gen_random_uuid(),
  merchant_id         uuid               not null references public.merchants(id) on delete cascade,
  table_id            uuid               references public.merchant_tables(id) on delete set null,
  order_number        integer            not null,
  session_token       text               not null,
  order_type          public.order_type  not null default 'dine_in',
  status              public.order_status not null default 'pending',
  customer_name       text,
  customer_notes      text,
  subtotal            numeric(12,2)      not null default 0,
  discount            numeric(12,2)      not null default 0,
  total               numeric(12,2)      not null default 0,
  confirmed_at        timestamptz,
  ready_at            timestamptz,
  delivered_at        timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz        not null default now(),
  created_day         date               not null default (timezone('utc', now())::date),
  updated_at          timestamptz        not null default now(),

  constraint orders_subtotal_gte_zero_chk check (subtotal >= 0),
  constraint orders_discount_gte_zero_chk check (discount >= 0),
  constraint orders_total_gte_zero_chk    check (total >= 0)
);

update public.orders
set created_day = (created_at at time zone 'utc')::date
where created_day is null;

-- Daily-unique without expression index.
drop index if exists public.orders_merchant_number_day_ux;
create unique index if not exists orders_merchant_number_day_ux
  on public.orders (merchant_id, order_number, created_day);

create index if not exists orders_session_token_ix
  on public.orders (session_token);

create index if not exists orders_merchant_id_ix
  on public.orders (merchant_id);

create index if not exists orders_table_id_ix
  on public.orders (table_id);

create index if not exists orders_merchant_active_ix
  on public.orders (merchant_id, status)
  where status not in ('completed', 'cancelled');

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists set_created_day on public.orders;
create trigger set_created_day
before insert on public.orders
for each row
execute function public.set_created_day_utc();

-- ────────────────────────────────────────────────────────────
-- ORDER ITEMS
-- ────────────────────────────────────────────────────────────
create table if not exists public.order_items (
  id            uuid           primary key default gen_random_uuid(),
  merchant_id   uuid           not null references public.merchants(id) on delete cascade,
  order_id      uuid           not null references public.orders(id) on delete cascade,
  product_id    uuid           references public.products(id) on delete set null,
  product_name  text           not null,
  quantity      integer        not null default 1,
  unit_price    numeric(12,2)  not null,
  options_total numeric(12,2)  not null default 0,
  line_total    numeric(12,2)  not null,
  notes         text,
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),

  constraint order_items_quantity_gte_one_chk check (quantity >= 1),
  constraint order_items_unit_price_gte_zero_chk check (unit_price >= 0),
  constraint order_items_line_total_gte_zero_chk check (line_total >= 0)
);

create index if not exists order_items_merchant_id_ix
  on public.order_items (merchant_id);

create index if not exists order_items_order_id_ix
  on public.order_items (order_id);

drop trigger if exists set_updated_at on public.order_items;
create trigger set_updated_at
before update on public.order_items
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ORDER ITEM OPTIONS
-- ────────────────────────────────────────────────────────────
create table if not exists public.order_item_options (
  id                uuid          primary key default gen_random_uuid(),
  merchant_id        uuid          not null references public.merchants(id) on delete cascade,
  order_item_id      uuid          not null references public.order_items(id) on delete cascade,
  option_id          uuid          references public.product_options(id) on delete set null,
  option_group_name  text          not null,
  option_name        text          not null,
  price_modifier     numeric(12,2) not null default 0,
  created_at         timestamptz   not null default now()
);

create index if not exists order_item_options_merchant_id_ix
  on public.order_item_options (merchant_id);

create index if not exists order_item_options_order_item_id_ix
  on public.order_item_options (order_item_id);

commit;
