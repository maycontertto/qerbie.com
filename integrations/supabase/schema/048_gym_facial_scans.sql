-- Qerbie / Supabase Schema
-- Version: 048_gym_facial_scans
-- Purpose: Suporte profissional de acesso biométrico para academias
-- Depends on: 043_gym_checkins

begin;

create extension if not exists vector with schema public;

create type public.gym_access_method as enum ('manual', 'qr', 'facial', 'fingerprint');
create type public.gym_access_result as enum ('accepted', 'denied', 'expired', 'manual_override');

create table if not exists public.gym_face_profiles (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  student_id uuid not null references public.gym_students(id) on delete cascade,
  face_label text not null default 'principal',
  embedding vector(128),
  image_url text,
  image_storage_path text,
  recognition_score numeric(5,4) default 0,
  quality_score integer default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gym_face_profiles_unique_per_student_label unique (merchant_id, student_id, face_label)
);

create index if not exists gym_face_profiles_merchant_id_ix
  on public.gym_face_profiles (merchant_id);

create index if not exists gym_face_profiles_student_id_ix
  on public.gym_face_profiles (student_id);

create index if not exists gym_face_profiles_active_ix
  on public.gym_face_profiles (merchant_id, is_active);

create table if not exists public.gym_fingerprint_templates (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  student_id uuid not null references public.gym_students(id) on delete cascade,
  finger_name text not null,
  template_text text not null,
  template_hash text,
  quality_score integer default 0,
  device_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gym_fingerprint_templates_unique_per_student_finger unique (merchant_id, student_id, finger_name)
);

create index if not exists gym_fingerprint_templates_merchant_ix
  on public.gym_fingerprint_templates (merchant_id);

create index if not exists gym_fingerprint_templates_student_ix
  on public.gym_fingerprint_templates (student_id);

create table if not exists public.gym_access_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  student_id uuid not null references public.gym_students(id) on delete cascade,
  checkin_id uuid references public.gym_checkins(id) on delete set null,
  method public.gym_access_method not null default 'manual',
  result public.gym_access_result not null default 'accepted',
  confidence numeric(5,4) default 0,
  device_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists gym_access_logs_merchant_created_ix
  on public.gym_access_logs (merchant_id, created_at desc);

create index if not exists gym_access_logs_student_created_ix
  on public.gym_access_logs (student_id, created_at desc);

alter table public.gym_checkins
  add column if not exists verification_method public.gym_access_method not null default 'manual',
  add column if not exists verification_confidence numeric(5,4) default 0,
  add column if not exists face_profile_id uuid references public.gym_face_profiles(id) on delete set null,
  add column if not exists fingerprint_template_id uuid references public.gym_fingerprint_templates(id) on delete set null,
  add column if not exists verified_by text;

create index if not exists gym_checkins_verification_method_ix
  on public.gym_checkins (merchant_id, verification_method, checkin_date desc);

create index if not exists gym_checkins_face_profile_id_ix
  on public.gym_checkins (face_profile_id);

create index if not exists gym_checkins_fingerprint_template_id_ix
  on public.gym_checkins (fingerprint_template_id);

commit;
