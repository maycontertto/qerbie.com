-- Qerbie / Supabase Schema
-- Version: 050_gym_students_profile_fields
-- Purpose: Campos opcionais de cadastro (telefone, endereço) para alunos de academia.
-- Depends on: 034_academias

begin;

alter table public.gym_students
  add column if not exists phone text,
  add column if not exists address text;

commit;
