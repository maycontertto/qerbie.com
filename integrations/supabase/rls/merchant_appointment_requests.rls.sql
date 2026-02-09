-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_appointment_requests
--
-- Anon customers can:
--   - INSERT a request (status=pending) for a slot
--   - SELECT their own requests via session_token
--
-- Authenticated staff can manage requests for their merchant.

begin;

alter table public.merchant_appointment_requests enable row level security;
alter table public.merchant_appointment_requests force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.merchant_appointment_requests from anon;
revoke all on table public.merchant_appointment_requests from authenticated;

grant select, insert on table public.merchant_appointment_requests to anon;
grant select, insert, update, delete on table public.merchant_appointment_requests to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customer can read their own requests by session_token.
drop policy if exists appointment_requests_anon_select on public.merchant_appointment_requests;
create policy appointment_requests_anon_select
on public.merchant_appointment_requests
for select
to anon
using (
  session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
);

-- Customer can request an appointment (status must be 'pending').
drop policy if exists appointment_requests_anon_insert on public.merchant_appointment_requests;
create policy appointment_requests_anon_insert
on public.merchant_appointment_requests
for insert
to anon
with check (
  status = 'pending'
  and session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists appointment_requests_auth_select on public.merchant_appointment_requests;
create policy appointment_requests_auth_select
on public.merchant_appointment_requests
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists appointment_requests_auth_insert on public.merchant_appointment_requests;
create policy appointment_requests_auth_insert
on public.merchant_appointment_requests
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists appointment_requests_auth_update on public.merchant_appointment_requests;
create policy appointment_requests_auth_update
on public.merchant_appointment_requests
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists appointment_requests_auth_delete on public.merchant_appointment_requests;
create policy appointment_requests_auth_delete
on public.merchant_appointment_requests
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
