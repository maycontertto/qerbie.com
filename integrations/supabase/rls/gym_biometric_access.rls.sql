-- Qerbie / Supabase RLS Policies
-- Tables: public.gym_face_profiles, public.gym_fingerprint_templates, public.gym_access_logs

begin;

alter table public.gym_face_profiles enable row level security;
alter table public.gym_face_profiles force row level security;

revoke all on table public.gym_face_profiles from anon;
revoke all on table public.gym_face_profiles from authenticated;

grant select on table public.gym_face_profiles to anon;
grant select, insert, update, delete on table public.gym_face_profiles to authenticated;

alter table public.gym_fingerprint_templates enable row level security;
alter table public.gym_fingerprint_templates force row level security;

revoke all on table public.gym_fingerprint_templates from anon;
revoke all on table public.gym_fingerprint_templates from authenticated;

grant select on table public.gym_fingerprint_templates to anon;
grant select, insert, update, delete on table public.gym_fingerprint_templates to authenticated;

alter table public.gym_access_logs enable row level security;
alter table public.gym_access_logs force row level security;

revoke all on table public.gym_access_logs from anon;
revoke all on table public.gym_access_logs from authenticated;

grant select on table public.gym_access_logs to anon;
grant select, insert, update, delete on table public.gym_access_logs to authenticated;

-- Student can read only their own biometric records by session token.
drop policy if exists gym_face_profiles_anon_select on public.gym_face_profiles;
create policy gym_face_profiles_anon_select
on public.gym_face_profiles
for select
to anon
using (
  exists (
    select 1
    from public.gym_students s
    where s.id = gym_face_profiles.student_id
      and s.session_token is not null
      and s.session_token = current_setting('request.headers', true)::json ->> 'x-gym-session-token'
  )
);

drop policy if exists gym_fingerprint_templates_anon_select on public.gym_fingerprint_templates;
create policy gym_fingerprint_templates_anon_select
on public.gym_fingerprint_templates
for select
to anon
using (
  exists (
    select 1
    from public.gym_students s
    where s.id = gym_fingerprint_templates.student_id
      and s.session_token is not null
      and s.session_token = current_setting('request.headers', true)::json ->> 'x-gym-session-token'
  )
);

drop policy if exists gym_access_logs_anon_select on public.gym_access_logs;
create policy gym_access_logs_anon_select
on public.gym_access_logs
for select
to anon
using (
  exists (
    select 1
    from public.gym_students s
    where s.id = gym_access_logs.student_id
      and s.session_token is not null
      and s.session_token = current_setting('request.headers', true)::json ->> 'x-gym-session-token'
  )
);

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
