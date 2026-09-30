-- Qerbie / Schema 061: tenant-scoped coupons for customer orders.
-- Run once in the Supabase SQL editor before enabling coupon checkout.

begin;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_subtotal numeric(12,2) not null default 0 check (minimum_subtotal >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_valid_range_chk check (valid_from is null or valid_until is null or valid_until > valid_from),
  constraint coupons_percent_limit_chk check (discount_type <> 'percent' or discount_value <= 100)
);

create unique index if not exists coupons_merchant_code_ux
  on public.coupons (merchant_id, upper(code));
create index if not exists coupons_merchant_active_ix
  on public.coupons (merchant_id, is_active, valid_until);

drop trigger if exists set_updated_at on public.coupons;
create trigger set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

alter table public.coupons enable row level security;
alter table public.coupons force row level security;
revoke all on table public.coupons from anon, authenticated;
grant select, insert, update, delete on table public.coupons to authenticated;

drop policy if exists coupons_auth_select on public.coupons;
create policy coupons_auth_select on public.coupons
for select to authenticated using (public.has_merchant_access(merchant_id));
drop policy if exists coupons_auth_insert on public.coupons;
create policy coupons_auth_insert on public.coupons
for insert to authenticated with check (public.has_merchant_access(merchant_id));
drop policy if exists coupons_auth_update on public.coupons;
create policy coupons_auth_update on public.coupons
for update to authenticated using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));
drop policy if exists coupons_auth_delete on public.coupons;
create policy coupons_auth_delete on public.coupons
for delete to authenticated using (public.has_merchant_access(merchant_id));

alter table public.orders add column if not exists coupon_code text;

commit;
