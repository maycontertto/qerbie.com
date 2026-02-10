-- Qerbie / Supabase Schema
-- Version: 033_billing_subscriptions
-- Purpose: Platform billing: 30-day trial, monthly invoices, suspension after grace.
-- Depends on: 002_merchants

begin;

-- Merchant subscription state (one row per merchant)
create table if not exists public.merchant_subscriptions (
  merchant_id         uuid primary key references public.merchants(id) on delete cascade,
  status              text not null default 'trialing',
  plan_amount_cents   integer not null default 2990,
  currency            text not null default 'BRL',
  trial_ends_at       timestamptz not null,
  current_period_start timestamptz,
  current_period_end  timestamptz,
  grace_until         timestamptz,
  last_payment_at     timestamptz,
  last_notice_stage   text,
  last_notice_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint merchant_subscriptions_status_chk check (
    status in ('trialing','active','past_due','suspended','cancelled')
  ),
  constraint merchant_subscriptions_amount_chk check (plan_amount_cents >= 0)
);

create index if not exists merchant_subscriptions_status_ix
  on public.merchant_subscriptions (status);

drop trigger if exists set_updated_at on public.merchant_subscriptions;
create trigger set_updated_at
before update on public.merchant_subscriptions
for each row
execute function public.set_updated_at();

-- Invoices (one per billing cycle)
create table if not exists public.billing_invoices (
  id                   uuid primary key default gen_random_uuid(),
  merchant_id          uuid not null references public.merchants(id) on delete cascade,
  amount_cents         integer not null,
  currency             text not null default 'BRL',
  status               text not null default 'pending',
  due_at               timestamptz not null,
  paid_at              timestamptz,
  provider             text not null default 'mercadopago',
  external_reference   text,
  provider_preference_id text,
  payment_url          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint billing_invoices_status_chk check (
    status in ('pending','paid','expired','cancelled')
  ),
  constraint billing_invoices_amount_chk check (amount_cents >= 0)
);

create index if not exists billing_invoices_merchant_status_ix
  on public.billing_invoices (merchant_id, status);

create unique index if not exists billing_invoices_external_reference_ux
  on public.billing_invoices (external_reference)
  where external_reference is not null;

drop trigger if exists set_updated_at on public.billing_invoices;
create trigger set_updated_at
before update on public.billing_invoices
for each row
execute function public.set_updated_at();

-- Helper: ensure subscription row exists for a merchant
create or replace function public.ensure_merchant_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.merchant_subscriptions (merchant_id, trial_ends_at)
  values (new.id, new.created_at + interval '30 days')
  on conflict (merchant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_merchant_subscription on public.merchants;
create trigger ensure_merchant_subscription
after insert on public.merchants
for each row
execute function public.ensure_merchant_subscription();

-- Backfill existing merchants
insert into public.merchant_subscriptions (merchant_id, trial_ends_at)
select m.id, m.created_at + interval '30 days'
from public.merchants m
left join public.merchant_subscriptions s on s.merchant_id = m.id
where s.merchant_id is null;

commit;
