-- Qerbie / Supabase Schema
-- Version: 034_academias
-- Purpose: Academias (planos, alunos, controle de mensalidade, QR de cadastro)
-- Depends on: 002_merchants

begin;

-- Plans
create table if not exists public.gym_plans (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  price_cents integer not null default 0,
  billing_period_months integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_plans_merchant_id_ix on public.gym_plans (merchant_id);

-- Modalities
create table if not exists public.gym_modalities (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_modalities_merchant_id_ix on public.gym_modalities (merchant_id);

-- Additional services
create table if not exists public.gym_additional_services (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  price_cents integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_additional_services_merchant_id_ix on public.gym_additional_services (merchant_id);

-- QR tokens for gym customer portal
create table if not exists public.gym_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  label text not null default 'Academia',
  qr_token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists gym_qr_tokens_merchant_id_ix on public.gym_qr_tokens (merchant_id);

-- Students
create table if not exists public.gym_students (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  login text not null,
  password_hash text not null,
  session_token text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gym_students_merchant_login_ux
  on public.gym_students (merchant_id, lower(login));

create index if not exists gym_students_merchant_id_ix on public.gym_students (merchant_id);
create index if not exists gym_students_session_token_ix on public.gym_students (session_token);

-- Memberships (monthly control)
create table if not exists public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  student_id uuid not null references public.gym_students(id) on delete cascade,
  plan_id uuid references public.gym_plans(id) on delete set null,
  status text not null default 'active' check (status in ('active','overdue','paused','cancelled')),
  next_due_at date,
  last_paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_memberships_merchant_id_ix on public.gym_memberships (merchant_id);
create index if not exists gym_memberships_student_id_ix on public.gym_memberships (student_id);
create index if not exists gym_memberships_next_due_at_ix on public.gym_memberships (merchant_id, next_due_at);

-- Payments ledger (manual control)
create table if not exists public.gym_payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  student_id uuid not null references public.gym_students(id) on delete cascade,
  membership_id uuid references public.gym_memberships(id) on delete set null,
  amount_cents integer not null default 0,
  paid_at timestamptz not null default now(),
  note text
);

create index if not exists gym_payments_merchant_id_ix on public.gym_payments (merchant_id, paid_at desc);
create index if not exists gym_payments_student_id_ix on public.gym_payments (student_id, paid_at desc);

commit;
