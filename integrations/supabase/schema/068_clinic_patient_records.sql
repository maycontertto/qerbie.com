-- Qerbie / Schema 068: private patient visit notes for clinics and practices.

begin;

create table if not exists public.clinic_patient_records (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  patient_name text not null check (char_length(trim(patient_name)) between 2 and 160),
  patient_contact text check (patient_contact is null or char_length(patient_contact) <= 160),
  visit_date date not null default current_date,
  reason text check (reason is null or char_length(reason) <= 1000),
  record_notes text not null check (char_length(trim(record_notes)) between 1 and 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_patient_records_merchant_visit_ix
  on public.clinic_patient_records (merchant_id, visit_date desc, created_at desc);

drop trigger if exists clinic_patient_records_set_updated_at on public.clinic_patient_records;
create trigger clinic_patient_records_set_updated_at
before update on public.clinic_patient_records
for each row execute function public.set_updated_at();

alter table public.clinic_patient_records enable row level security;
alter table public.clinic_patient_records force row level security;

revoke all on table public.clinic_patient_records from anon, authenticated;
grant select, insert, update, delete on table public.clinic_patient_records to authenticated;

drop policy if exists clinic_patient_records_owner_select on public.clinic_patient_records;
create policy clinic_patient_records_owner_select on public.clinic_patient_records
for select to authenticated using (public.is_merchant_owner(merchant_id));

drop policy if exists clinic_patient_records_owner_insert on public.clinic_patient_records;
create policy clinic_patient_records_owner_insert on public.clinic_patient_records
for insert to authenticated with check (public.is_merchant_owner(merchant_id));

drop policy if exists clinic_patient_records_owner_update on public.clinic_patient_records;
create policy clinic_patient_records_owner_update on public.clinic_patient_records
for update to authenticated using (public.is_merchant_owner(merchant_id))
with check (public.is_merchant_owner(merchant_id));

drop policy if exists clinic_patient_records_owner_delete on public.clinic_patient_records;
create policy clinic_patient_records_owner_delete on public.clinic_patient_records
for delete to authenticated using (public.is_merchant_owner(merchant_id));

commit;
