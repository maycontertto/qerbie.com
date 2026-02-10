-- Qerbie / Supabase RLS Policies
-- Table: public.gym_students

begin;

alter table public.gym_students enable row level security;
alter table public.gym_students force row level security;

revoke all on table public.gym_students from anon;
revoke all on table public.gym_students from authenticated;

grant select on table public.gym_students to anon;
grant select, insert, update, delete on table public.gym_students to authenticated;

-- Anon: student can read their own record via session token header
-- NOTE: This is intended for the gym customer portal.
drop policy if exists gym_students_anon_select on public.gym_students;
create policy gym_students_anon_select
on public.gym_students
for select
to anon
using (
  session_token is not null
  and session_token = current_setting('request.headers', true)::json ->> 'x-gym-session-token'
);

-- Authenticated: merchant staff

drop policy if exists gym_students_auth_select on public.gym_students;
create policy gym_students_auth_select
on public.gym_students
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_students_auth_insert on public.gym_students;
create policy gym_students_auth_insert
on public.gym_students
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_students_auth_update on public.gym_students;
create policy gym_students_auth_update
on public.gym_students
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_students_auth_delete on public.gym_students;
create policy gym_students_auth_delete
on public.gym_students
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
