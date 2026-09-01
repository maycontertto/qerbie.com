-- Qerbie / Supabase Schema
-- Version: 049_gym_access_checkinout_and_fingerprint_match
-- Purpose: Suporta registro de entrada E saída (horário de pico) e identificação
--          1:N por leitor de digital USB (device_user_code), além de evidência
--          fotográfica no log de acesso.
-- Depends on: 048_gym_facial_scans

begin;

alter table public.gym_checkins
  add column if not exists checked_out_at timestamptz,
  add column if not exists checkout_verification_method public.gym_access_method,
  add column if not exists checkout_verification_confidence numeric(5,4) default 0,
  add column if not exists checkout_verified_by text;

create index if not exists gym_checkins_checked_out_at_ix
  on public.gym_checkins (merchant_id, checked_out_at);

-- Código atribuído pelo leitor de digital (modo teclado/keyboard-wedge) para
-- permitir identificação do aluno sem seleção manual na tela.
alter table public.gym_fingerprint_templates
  add column if not exists device_user_code text;

create unique index if not exists gym_fingerprint_templates_device_code_ux
  on public.gym_fingerprint_templates (merchant_id, device_user_code)
  where device_user_code is not null;

alter table public.gym_access_logs
  add column if not exists evidence_image_url text,
  add column if not exists evidence_image_path text,
  add column if not exists direction text not null default 'in';

alter table public.gym_access_logs
  drop constraint if exists gym_access_logs_direction_check;

alter table public.gym_access_logs
  add constraint gym_access_logs_direction_check check (direction in ('in', 'out'));

commit;
