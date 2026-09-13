-- Qerbie / Supabase Schema
-- Version: 053_cash_register
-- Purpose: Sessões auditáveis de caixa, entradas/sangrias e comprovantes privados.
-- Depends on: 002_merchants, 006_orders, 015_storage_product_images

begin;

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  opened_by_user_id uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opening_amount numeric(12,2) not null default 0 check (opening_amount >= 0),
  opening_notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_by_user_id uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  expected_amount numeric(12,2),
  counted_amount numeric(12,2),
  difference_amount numeric(12,2),
  closing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cash_register_one_open_per_merchant_ix
  on public.cash_register_sessions (merchant_id) where status = 'open';
create index if not exists cash_register_sessions_history_ix
  on public.cash_register_sessions (merchant_id, opened_at desc);

create table if not exists public.cash_register_movements (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  session_id uuid not null references public.cash_register_sessions(id) on delete cascade,
  movement_type text not null check (movement_type in ('withdrawal', 'deposit')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (char_length(reason) between 3 and 300),
  receipt_path text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists cash_register_movements_session_ix
  on public.cash_register_movements (session_id, created_at desc);

alter table public.orders
  add column if not exists cash_session_id uuid references public.cash_register_sessions(id) on delete set null;
create index if not exists orders_cash_session_ix
  on public.orders (cash_session_id) where cash_session_id is not null;

alter table public.cash_register_sessions enable row level security;
alter table public.cash_register_sessions force row level security;
alter table public.cash_register_movements enable row level security;
alter table public.cash_register_movements force row level security;

revoke all on table public.cash_register_sessions from anon, authenticated;
revoke all on table public.cash_register_movements from anon, authenticated;
grant select, insert, update on table public.cash_register_sessions to authenticated;
grant select, insert on table public.cash_register_movements to authenticated;

drop policy if exists cash_register_sessions_select on public.cash_register_sessions;
create policy cash_register_sessions_select on public.cash_register_sessions
for select to authenticated using (public.has_merchant_access(merchant_id));
drop policy if exists cash_register_sessions_insert on public.cash_register_sessions;
create policy cash_register_sessions_insert on public.cash_register_sessions
for insert to authenticated with check (
  public.has_merchant_access(merchant_id) and opened_by_user_id = auth.uid()
);
drop policy if exists cash_register_sessions_update on public.cash_register_sessions;
create policy cash_register_sessions_update on public.cash_register_sessions
for update to authenticated using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists cash_register_movements_select on public.cash_register_movements;
create policy cash_register_movements_select on public.cash_register_movements
for select to authenticated using (public.has_merchant_access(merchant_id));
drop policy if exists cash_register_movements_insert on public.cash_register_movements;
create policy cash_register_movements_insert on public.cash_register_movements
for insert to authenticated with check (
  public.has_merchant_access(merchant_id) and created_by_user_id = auth.uid()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cash-receipts',
  'cash-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cash_receipts_select on storage.objects;
create policy cash_receipts_select on storage.objects for select to authenticated
using (
  bucket_id = 'cash-receipts'
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);
drop policy if exists cash_receipts_insert on storage.objects;
create policy cash_receipts_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'cash-receipts'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

commit;