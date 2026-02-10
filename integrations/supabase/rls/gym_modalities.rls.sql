-- Qerbie / Supabase RLS Policies
-- Table: public.gym_modalities

begin;

alter table public.gym_modalities enable row level security;
alter table public.gym_modalities force row level security;

revoke all on table public.gym_modalities from anon;
revoke all on table public.gym_modalities from authenticated;

grant select, insert, update, delete on table public.gym_modalities to authenticated;

drop policy if exists gym_modalities_auth_select on public.gym_modalities;
create policy gym_modalities_auth_select
on public.gym_modalities
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_modalities_auth_insert on public.gym_modalities;
create policy gym_modalities_auth_insert
on public.gym_modalities
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_modalities_auth_update on public.gym_modalities;
create policy gym_modalities_auth_update
on public.gym_modalities
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_modalities_auth_delete on public.gym_modalities;
create policy gym_modalities_auth_delete
on public.gym_modalities
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
