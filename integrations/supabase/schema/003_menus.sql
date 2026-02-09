-- Qerbie / Supabase Schema
-- Version: 003_menus
-- Purpose: Menus (or service catalogs) and their categories, scoped to merchant.
-- Depends on: 001_init, 002_merchants

begin;

-- ────────────────────────────────────────────────────────────
-- Convenience predicate: owner OR member  (used by all
-- tenant-scoped RLS from this point forward).
-- SECURITY DEFINER avoids RLS recursion.
-- ────────────────────────────────────────────────────────────
create or replace function public.has_merchant_access(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_merchant_owner(p_merchant_id)
    or public.is_merchant_member(p_merchant_id);
$$;

revoke all on function public.has_merchant_access(uuid) from public;
grant execute on function public.has_merchant_access(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────
-- MENUS
-- Represents a menu (restaurant) or service catalog (clinic,
-- pharmacy, etc.) belonging to a single merchant.
-- ────────────────────────────────────────────────────────────
create table if not exists public.menus (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  name          text        not null,
  description   text,
  slug          citext      not null,
  is_active     boolean     not null default true,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Slug unique per merchant (allows different merchants to share slugs).
  constraint menus_merchant_slug_ux unique (merchant_id, slug),
  constraint menus_slug_length_chk  check (char_length(slug) >= 2 and char_length(slug) <= 128),
  constraint menus_slug_format_chk  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists menus_merchant_id_ix
  on public.menus (merchant_id);

create index if not exists menus_merchant_active_ix
  on public.menus (merchant_id)
  where is_active = true;

drop trigger if exists set_updated_at on public.menus;
create trigger set_updated_at
before update on public.menus
for each row
execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- MENU CATEGORIES
-- Groups of items inside a menu (e.g. "Appetizers", "Mains",
-- "Lab Exams", etc.). Always scoped to merchant + menu.
-- ────────────────────────────────────────────────────────────
create table if not exists public.menu_categories (
  id            uuid        primary key default gen_random_uuid(),
  merchant_id   uuid        not null references public.merchants(id) on delete cascade,
  menu_id       uuid        not null references public.menus(id) on delete cascade,
  name          text        not null,
  description   text,
  is_active     boolean     not null default true,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists menu_categories_merchant_id_ix
  on public.menu_categories (merchant_id);

create index if not exists menu_categories_menu_id_ix
  on public.menu_categories (menu_id);

create index if not exists menu_categories_menu_active_ix
  on public.menu_categories (menu_id)
  where is_active = true;

drop trigger if exists set_updated_at on public.menu_categories;
create trigger set_updated_at
before update on public.menu_categories
for each row
execute function public.set_updated_at();

commit;
