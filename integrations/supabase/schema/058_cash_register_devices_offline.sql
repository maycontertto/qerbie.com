-- Qerbie / Supabase Schema
-- Version: 058_cash_register_devices_offline
-- Purpose: múltiplos caixas por loja, vínculo de operador e idempotência no PDV.
-- Depends on: 002_merchants, 006_orders, 053_cash_register

begin;

create table if not exists public.cash_register_devices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  is_active boolean not null default true,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, name),
  unique (id, merchant_id)
);

alter table public.merchant_members
  add column if not exists cash_register_device_id uuid;

alter table public.cash_register_sessions
  add column if not exists cash_register_device_id uuid;

-- Every existing store gets a default register. Existing cash sessions remain
-- attached to that register so historical reports stay available.
insert into public.cash_register_devices (merchant_id, name, created_by_user_id)
select m.id, 'Caixa principal', m.owner_user_id
from public.merchants m
where not exists (
  select 1 from public.cash_register_devices d where d.merchant_id = m.id
);

create or replace function public.ensure_default_cash_register_device()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cash_register_devices (merchant_id, name, created_by_user_id)
  values (new.id, 'Caixa principal', new.owner_user_id)
  on conflict (merchant_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists merchants_default_cash_register_device on public.merchants;
create trigger merchants_default_cash_register_device
after insert on public.merchants
for each row execute function public.ensure_default_cash_register_device();

update public.cash_register_sessions s
set cash_register_device_id = d.id
from public.cash_register_devices d
where d.merchant_id = s.merchant_id
  and s.cash_register_device_id is null;

alter table public.cash_register_sessions
  alter column cash_register_device_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'merchant_members_cash_register_device_fkey') then
    alter table public.merchant_members
      add constraint merchant_members_cash_register_device_fkey
      foreign key (cash_register_device_id, merchant_id)
      references public.cash_register_devices(id, merchant_id) on delete set null (cash_register_device_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cash_sessions_register_device_fkey') then
    alter table public.cash_register_sessions
      add constraint cash_sessions_register_device_fkey
      foreign key (cash_register_device_id, merchant_id)
      references public.cash_register_devices(id, merchant_id) on delete restrict;
  end if;
end $$;

drop index if exists public.cash_register_one_open_per_merchant_ix;
create unique index if not exists cash_register_one_open_per_device_ix
  on public.cash_register_sessions (merchant_id, cash_register_device_id) where status = 'open';

alter table public.orders
  add column if not exists cash_register_device_id uuid,
  add column if not exists cashier_user_id uuid references auth.users(id) on delete set null,
  add column if not exists client_sale_id uuid,
  add column if not exists offline_synced_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_register_device_fkey') then
    alter table public.orders
      add constraint orders_register_device_fkey
      foreign key (cash_register_device_id, merchant_id)
      references public.cash_register_devices(id, merchant_id) on delete set null (cash_register_device_id);
  end if;
end $$;

update public.orders o
set cash_register_device_id = s.cash_register_device_id
from public.cash_register_sessions s
where o.cash_session_id = s.id and o.cash_register_device_id is null;

create unique index if not exists orders_merchant_client_sale_ux
  on public.orders (merchant_id, client_sale_id) where client_sale_id is not null;
create index if not exists orders_register_history_ix
  on public.orders (merchant_id, cash_register_device_id, created_at desc)
  where cash_register_device_id is not null;
create index if not exists cash_register_devices_merchant_ix
  on public.cash_register_devices (merchant_id, is_active, name);

alter table public.cash_register_devices enable row level security;
alter table public.cash_register_devices force row level security;
revoke all on table public.cash_register_devices from anon, authenticated;
grant select, insert, update on table public.cash_register_devices to authenticated;

drop policy if exists cash_register_devices_select on public.cash_register_devices;
create policy cash_register_devices_select on public.cash_register_devices
for select to authenticated using (public.has_merchant_access(merchant_id));
drop policy if exists cash_register_devices_insert on public.cash_register_devices;
create policy cash_register_devices_insert on public.cash_register_devices
for insert to authenticated with check (
  created_by_user_id = auth.uid() and (
    public.is_merchant_owner(merchant_id)
    or exists (
      select 1 from public.merchant_members mm
      where mm.merchant_id = cash_register_devices.merchant_id
        and mm.user_id = auth.uid()
        and (mm.role = 'admin' or coalesce((mm.permissions ->> 'manage_attendants')::boolean, false))
    )
  )
);
drop policy if exists cash_register_devices_update on public.cash_register_devices;
create policy cash_register_devices_update on public.cash_register_devices
for update to authenticated using (
  public.is_merchant_owner(merchant_id)
  or exists (
    select 1 from public.merchant_members mm
    where mm.merchant_id = cash_register_devices.merchant_id
      and mm.user_id = auth.uid()
      and (mm.role = 'admin' or coalesce((mm.permissions ->> 'manage_attendants')::boolean, false))
  )
)
with check (public.has_merchant_access(merchant_id));

commit;
