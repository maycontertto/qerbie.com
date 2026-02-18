-- Qerbie / Supabase Schema
-- Version: 043_gym_checkins
-- Purpose: Check-in simples de entrada para alunos da academia
-- Depends on: 034_academias

begin;

create table if not exists public.gym_checkins (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  student_id uuid not null references public.gym_students(id) on delete cascade,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Avoid duplicates: 1 check-in por dia por aluno (por academia)
create unique index if not exists gym_checkins_unique_per_day_ux
  on public.gym_checkins (merchant_id, student_id, checkin_date);

create index if not exists gym_checkins_merchant_date_ix
  on public.gym_checkins (merchant_id, checkin_date desc);

create index if not exists gym_checkins_student_date_ix
  on public.gym_checkins (student_id, checkin_date desc);

commit;
