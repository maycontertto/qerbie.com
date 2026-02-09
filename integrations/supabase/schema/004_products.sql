-- Qerbie / Supabase Schema
-- Version: 004_products
-- Purpose: Products (items), option groups, and options scoped to merchant.
-- Depends on: 001_init, 002_merchants, 003_menus

begin;

-- ────────────────────────────────────────────────────────────
-- PRODUCTS
-- A sellable/orderable item inside a menu category.
-- Examples: "Margherita Pizza", "Blood Test", "Ibuprofen 400mg"
-- ────────────────────────────────────────────────────────────
create table if not exists public.products (
  id               uuid           primary key default gen_random_uuid(),
  merchant_id      uuid           not null references public.merchants(id) on delete cascade,
  menu_id          uuid           not null references public.menus(id) on delete cascade,
  category_id      uuid           references public.menu_categories(id) on delete set null,
  name             text           not null,
  description      text,
  image_url        text,
  price            numeric(12,2)  not null default 0,
  is_active        boolean        not null default true,
  is_featured      boolean        not null default false,
  display_order    integer        not null default 0,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now(),

  constraint products_price_positive_chk check (price >= 0)
);

create index if not exists products_merchant_id_ix
  on public.products (merchant_id);

create index if not exists products_menu_id_ix
  on public.products (menu_id);

create index if not exists products_category_id_ix
  on public.products (category_id);

create index if not exists products_merchant_active_ix
  on public.products (merchant_id)
  where is_active = true;

create index if not exists products_menu_active_ix
  on public.products (menu_id)
  where is_active = true;

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRODUCT OPTION GROUPS
-- A named group of selectable options for a product.
-- Examples: "Size" (S/M/L), "Extras" (bacon, egg), "Dosage"
-- ────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'option_group_selection_type' and n.nspname = 'public'
  ) then
    create type public.option_group_selection_type as enum ('single', 'multiple');
  end if;
end
$$;

create table if not exists public.product_option_groups (
  id              uuid        primary key default gen_random_uuid(),
  merchant_id     uuid        not null references public.merchants(id) on delete cascade,
  product_id      uuid        not null references public.products(id) on delete cascade,
  name            text        not null,
  selection_type  public.option_group_selection_type not null default 'single',
  is_required     boolean     not null default false,
  min_selections  integer     not null default 0,
  max_selections  integer     not null default 1,
  display_order   integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint option_groups_min_lte_max_chk check (min_selections <= max_selections),
  constraint option_groups_min_gte_zero_chk check (min_selections >= 0),
  constraint option_groups_max_gte_one_chk  check (max_selections >= 1)
);

create index if not exists product_option_groups_merchant_id_ix
  on public.product_option_groups (merchant_id);

create index if not exists product_option_groups_product_id_ix
  on public.product_option_groups (product_id);

drop trigger if exists set_updated_at on public.product_option_groups;
create trigger set_updated_at
before update on public.product_option_groups
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PRODUCT OPTIONS
-- Individual selectable option inside a group.
-- Examples: "Small (+0)", "Large (+5.00)", "Extra cheese (+2.50)"
-- ────────────────────────────────────────────────────────────
create table if not exists public.product_options (
  id               uuid           primary key default gen_random_uuid(),
  merchant_id      uuid           not null references public.merchants(id) on delete cascade,
  option_group_id  uuid           not null references public.product_option_groups(id) on delete cascade,
  name             text           not null,
  price_modifier   numeric(12,2)  not null default 0,
  is_active        boolean        not null default true,
  display_order    integer        not null default 0,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now()
);

create index if not exists product_options_merchant_id_ix
  on public.product_options (merchant_id);

create index if not exists product_options_option_group_id_ix
  on public.product_options (option_group_id);

drop trigger if exists set_updated_at on public.product_options;
create trigger set_updated_at
before update on public.product_options
for each row
execute function public.set_updated_at();

commit;
