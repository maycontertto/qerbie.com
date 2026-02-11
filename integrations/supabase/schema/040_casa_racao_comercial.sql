-- Qerbie / Supabase Schema
-- Version: 040_casa_racao_comercial
-- Purpose: Base comercial para Casa de Ração (fornecedores, clientes, custos e códigos em produtos).
-- Depends on: 002_merchants, 004_products, 010_orders_v2 (ou 006_orders), 028_stock

begin;

-- ────────────────────────────────────────────────────────────
-- FORNECEDORES (por lojista/merchant)
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_suppliers (
  id          uuid        primary key default gen_random_uuid(),
  merchant_id uuid        not null references public.merchants(id) on delete cascade,
  name        text        not null,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists merchant_suppliers_merchant_id_ix
  on public.merchant_suppliers (merchant_id);

create index if not exists merchant_suppliers_merchant_name_ix
  on public.merchant_suppliers (merchant_id, name);

drop trigger if exists set_updated_at on public.merchant_suppliers;
create trigger set_updated_at
before update on public.merchant_suppliers
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- CLIENTES (interno do merchant; útil para caixa/recorrência)
-- ────────────────────────────────────────────────────────────
create table if not exists public.merchant_customers (
  id          uuid        primary key default gen_random_uuid(),
  merchant_id uuid        not null references public.merchants(id) on delete cascade,
  name        text        not null,
  phone       text,
  notes       text,
  tags        text[]      not null default '{}'::text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists merchant_customers_merchant_id_ix
  on public.merchant_customers (merchant_id);

create index if not exists merchant_customers_merchant_phone_ix
  on public.merchant_customers (merchant_id, phone);

create index if not exists merchant_customers_merchant_name_ix
  on public.merchant_customers (merchant_id, name);

drop trigger if exists set_updated_at on public.merchant_customers;
create trigger set_updated_at
before update on public.merchant_customers
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRODUTOS: custo, margem, códigos e fornecedor
-- ────────────────────────────────────────────────────────────
alter table public.products
  add column if not exists internal_code text;

alter table public.products
  add column if not exists barcode text;

alter table public.products
  add column if not exists cost_price numeric(12,2) not null default 0;

alter table public.products
  add column if not exists avg_cost numeric(12,2) not null default 0;

alter table public.products
  add column if not exists margin_percent numeric(7,2);

alter table public.products
  add column if not exists supplier_id uuid references public.merchant_suppliers(id) on delete set null;

alter table public.products
  add column if not exists stock_min_quantity integer not null default 0;

-- Constraints (idempotente via drop/add)
alter table public.products
  drop constraint if exists products_cost_price_positive_chk;

alter table public.products
  add constraint products_cost_price_positive_chk check (cost_price >= 0);

alter table public.products
  drop constraint if exists products_avg_cost_positive_chk;

alter table public.products
  add constraint products_avg_cost_positive_chk check (avg_cost >= 0);

alter table public.products
  drop constraint if exists products_margin_percent_range_chk;

alter table public.products
  add constraint products_margin_percent_range_chk check (
    margin_percent is null or (margin_percent >= 0 and margin_percent <= 1000)
  );

alter table public.products
  drop constraint if exists products_stock_min_gte_zero_chk;

alter table public.products
  add constraint products_stock_min_gte_zero_chk check (stock_min_quantity >= 0);

-- Indexes
create index if not exists products_merchant_supplier_ix
  on public.products (merchant_id, supplier_id);

-- Unique por merchant quando informado
drop index if exists public.products_merchant_internal_code_ux;
create unique index if not exists products_merchant_internal_code_ux
  on public.products (merchant_id, internal_code)
  where internal_code is not null and btrim(internal_code) <> '';

drop index if exists public.products_merchant_barcode_ux;
create unique index if not exists products_merchant_barcode_ux
  on public.products (merchant_id, barcode)
  where barcode is not null and btrim(barcode) <> '';

-- ────────────────────────────────────────────────────────────
-- ORDERS: vincular cliente (opcional) + telefone (opcional)
-- ────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists customer_id uuid references public.merchant_customers(id) on delete set null;

alter table public.orders
  add column if not exists customer_phone text;

create index if not exists orders_merchant_customer_id_ix
  on public.orders (merchant_id, customer_id);

commit;
