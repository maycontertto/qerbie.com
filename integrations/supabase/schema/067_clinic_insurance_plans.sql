-- Qerbie / Schema 067: private insurance-provider and plan registry for clinics.

begin;

create table if not exists public.clinic_insurance_plans (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  provider_name text not null check (char_length(trim(provider_name)) between 2 and 120),
  plan_name text not null check (char_length(trim(plan_name)) between 2 and 120),
  registration_code text check (registration_code is null or char_length(registration_code) <= 80),
  contact text check (contact is null or char_length(contact) <= 160),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinic_insurance_plans_merchant_active_ix
  on public.clinic_insurance_plans (merchant_id, is_active, provider_name, plan_name);

drop trigger if exists clinic_insurance_plans_set_updated_at on public.clinic_insurance_plans;
create trigger clinic_insurance_plans_set_updated_at
before update on public.clinic_insurance_plans
for each row execute function public.set_updated_at();

alter table public.clinic_insurance_plans enable row level security;
alter table public.clinic_insurance_plans force row level security;

revoke all on table public.clinic_insurance_plans from anon, authenticated;
grant select, insert, update, delete on table public.clinic_insurance_plans to authenticated;

drop policy if exists clinic_insurance_plans_auth_select on public.clinic_insurance_plans;
create policy clinic_insurance_plans_auth_select
on public.clinic_insurance_plans for select to authenticated
using (public.is_merchant_owner(merchant_id));

drop policy if exists clinic_insurance_plans_auth_insert on public.clinic_insurance_plans;
create policy clinic_insurance_plans_auth_insert
on public.clinic_insurance_plans for insert to authenticated
with check (public.is_merchant_owner(merchant_id));

drop policy if exists clinic_insurance_plans_auth_update on public.clinic_insurance_plans;
create policy clinic_insurance_plans_auth_update
on public.clinic_insurance_plans for update to authenticated
using (public.is_merchant_owner(merchant_id))
with check (public.is_merchant_owner(merchant_id));

drop policy if exists clinic_insurance_plans_auth_delete on public.clinic_insurance_plans;
create policy clinic_insurance_plans_auth_delete
on public.clinic_insurance_plans for delete to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
