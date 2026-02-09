-- Qerbie / Supabase Schema
-- Version: 002_merchants
-- Purpose: Multi-tenant core (merchants) + linkage to auth.users.

begin;

-- Status enum (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'merchant_status' and n.nspname = 'public'
  ) then
    create type public.merchant_status as enum ('active', 'paused', 'disabled');
  end if;
end
$$;

-- Members roles (idempotent). Owner is modeled on merchants.owner_user_id.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'merchant_member_role' and n.nspname = 'public'
  ) then
    create type public.merchant_member_role as enum ('admin', 'staff');
  end if;
end
$$;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  slug citext not null,
  status public.merchant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchants_slug_length_chk check (char_length(slug) >= 3 and char_length(slug) <= 64),
  constraint merchants_slug_format_chk check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- Unique slug across all merchants (for subdomain/path routing).
create unique index if not exists merchants_slug_ux on public.merchants (slug);
create index if not exists merchants_owner_user_id_ix on public.merchants (owner_user_id);

drop trigger if exists set_updated_at on public.merchants;
create trigger set_updated_at
before update on public.merchants
for each row
execute function public.set_updated_at();

create table if not exists public.merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.merchant_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_members_merchant_user_ux unique (merchant_id, user_id)
);

create index if not exists merchant_members_merchant_id_ix on public.merchant_members (merchant_id);
create index if not exists merchant_members_user_id_ix on public.merchant_members (user_id);

drop trigger if exists set_updated_at on public.merchant_members;
create trigger set_updated_at
before update on public.merchant_members
for each row
execute function public.set_updated_at();

-- Helper predicates for RLS. SECURITY DEFINER to avoid RLS recursion on merchant_members.
create or replace function public.is_merchant_owner(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchants m
    where m.id = p_merchant_id
      and m.owner_user_id = auth.uid()
  );
$$;

revoke all on function public.is_merchant_owner(uuid) from public;
grant execute on function public.is_merchant_owner(uuid) to authenticated;

create or replace function public.is_merchant_member(p_merchant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.merchant_members mm
    where mm.merchant_id = p_merchant_id
      and mm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_merchant_member(uuid) from public;
grant execute on function public.is_merchant_member(uuid) to authenticated;

commit;
