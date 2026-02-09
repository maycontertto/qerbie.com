-- Qerbie / Supabase Schema
-- Version: 030_exchange_requests
-- Purpose: Simple exchange/return requests for stores.
-- Depends on: 006_orders

begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'exchange_request_status' and n.nspname = 'public'
  ) then
    create type public.exchange_request_status as enum ('open', 'in_progress', 'done', 'cancelled');
  end if;
end
$$;

create table if not exists public.merchant_exchange_requests (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,

  customer_name text,
  contact       text,
  reason        text,
  notes         text,

  status public.exchange_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exchange_customer_name_len_chk check (customer_name is null or char_length(customer_name) <= 120),
  constraint exchange_contact_len_chk check (contact is null or char_length(contact) <= 200),
  constraint exchange_reason_len_chk check (reason is null or char_length(reason) <= 800),
  constraint exchange_notes_len_chk check (notes is null or char_length(notes) <= 1200)
);

create index if not exists merchant_exchange_requests_merchant_id_ix
  on public.merchant_exchange_requests (merchant_id);

create index if not exists merchant_exchange_requests_merchant_status_ix
  on public.merchant_exchange_requests (merchant_id, status);

create index if not exists merchant_exchange_requests_order_id_ix
  on public.merchant_exchange_requests (order_id);

drop trigger if exists set_updated_at on public.merchant_exchange_requests;
create trigger set_updated_at
before update on public.merchant_exchange_requests
for each row
execute function public.set_updated_at();

commit;
