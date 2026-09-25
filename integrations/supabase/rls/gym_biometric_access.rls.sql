-- Qerbie / Supabase RLS Policies
-- Tables: public.gym_face_profiles, public.gym_fingerprint_templates, public.gym_access_logs

begin;

alter table public.gym_face_profiles enable row level security;
alter table public.gym_face_profiles force row level security;

revoke all on table public.gym_face_profiles from public, anon;
revoke all on table public.gym_face_profiles from authenticated;

grant select, insert, update, delete on table public.gym_face_profiles to authenticated;

alter table public.gym_fingerprint_templates enable row level security;
alter table public.gym_fingerprint_templates force row level security;

revoke all on table public.gym_fingerprint_templates from public, anon;
revoke all on table public.gym_fingerprint_templates from authenticated;

grant select, insert, update, delete on table public.gym_fingerprint_templates to authenticated;

alter table public.gym_access_logs enable row level security;
alter table public.gym_access_logs force row level security;

revoke all on table public.gym_access_logs from public, anon;
revoke all on table public.gym_access_logs from authenticated;

grant select, insert, update, delete on table public.gym_access_logs to authenticated;

-- Authenticated staff: merchant access.
drop policy if exists gym_face_profiles_auth_select on public.gym_face_profiles;
create policy gym_face_profiles_auth_select
on public.gym_face_profiles
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_face_profiles_auth_insert on public.gym_face_profiles;
create policy gym_face_profiles_auth_insert
on public.gym_face_profiles
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_face_profiles_auth_update on public.gym_face_profiles;
create policy gym_face_profiles_auth_update
on public.gym_face_profiles
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_face_profiles_auth_delete on public.gym_face_profiles;
create policy gym_face_profiles_auth_delete
on public.gym_face_profiles
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

drop policy if exists gym_fingerprint_templates_auth_select on public.gym_fingerprint_templates;
create policy gym_fingerprint_templates_auth_select
on public.gym_fingerprint_templates
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_fingerprint_templates_auth_insert on public.gym_fingerprint_templates;
create policy gym_fingerprint_templates_auth_insert
on public.gym_fingerprint_templates
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_fingerprint_templates_auth_update on public.gym_fingerprint_templates;
create policy gym_fingerprint_templates_auth_update
on public.gym_fingerprint_templates
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_fingerprint_templates_auth_delete on public.gym_fingerprint_templates;
create policy gym_fingerprint_templates_auth_delete
on public.gym_fingerprint_templates
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

drop policy if exists gym_access_logs_auth_select on public.gym_access_logs;
create policy gym_access_logs_auth_select
on public.gym_access_logs
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_access_logs_auth_insert on public.gym_access_logs;
create policy gym_access_logs_auth_insert
on public.gym_access_logs
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_access_logs_auth_update on public.gym_access_logs;
create policy gym_access_logs_auth_update
on public.gym_access_logs
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_access_logs_auth_delete on public.gym_access_logs;
create policy gym_access_logs_auth_delete
on public.gym_access_logs
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
