-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_appointment_slots
--
-- Anon customers can:
--   - SELECT available future slots
--
-- Authenticated staff can manage all slots for their merchant.

begin;

alter table public.merchant_appointment_slots enable row level security;
alter table public.merchant_appointment_slots force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.merchant_appointment_slots from anon;
revoke all on table public.merchant_appointment_slots from authenticated;

grant select on table public.merchant_appointment_slots to anon;
grant select, insert, update, delete on table public.merchant_appointment_slots to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customers can only see available slots in the future.
drop policy if exists appointment_slots_anon_select on public.merchant_appointment_slots;
create policy appointment_slots_anon_select
on public.merchant_appointment_slots
for select
to anon
using (
  is_active = true
  and status = 'available'
  and starts_at >= now()
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists appointment_slots_auth_select on public.merchant_appointment_slots;
create policy appointment_slots_auth_select
on public.merchant_appointment_slots
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists appointment_slots_auth_insert on public.merchant_appointment_slots;
create policy appointment_slots_auth_insert
on public.merchant_appointment_slots
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists appointment_slots_auth_update on public.merchant_appointment_slots;
create policy appointment_slots_auth_update
on public.merchant_appointment_slots
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists appointment_slots_auth_delete on public.merchant_appointment_slots;
create policy appointment_slots_auth_delete
on public.merchant_appointment_slots
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
