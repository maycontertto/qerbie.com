-- Qerbie / Supabase RLS Policies
-- Table: public.pet_queue_services

begin;

alter table public.pet_queue_services enable row level security;
alter table public.pet_queue_services force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.pet_queue_services from anon;
revoke all on table public.pet_queue_services from authenticated;

grant select on table public.pet_queue_services to anon;
grant select, insert, update, delete on table public.pet_queue_services to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customers can see mapping only for the merchant of the scanned QR.
drop policy if exists pet_queue_services_anon_select on public.pet_queue_services;
create policy pet_queue_services_anon_select
on public.pet_queue_services
for select
to anon
using (
  exists (
    select 1
    from public.pet_qr_tokens t
    where t.qr_token = (current_setting('request.headers', true)::json ->> 'x-pet-qr-token')
      and t.is_active = true
      and t.merchant_id = pet_queue_services.merchant_id
  )
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists pet_queue_services_auth_select on public.pet_queue_services;
create policy pet_queue_services_auth_select
on public.pet_queue_services
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists pet_queue_services_auth_insert on public.pet_queue_services;
create policy pet_queue_services_auth_insert
on public.pet_queue_services
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists pet_queue_services_auth_update on public.pet_queue_services;
create policy pet_queue_services_auth_update
on public.pet_queue_services
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists pet_queue_services_auth_delete on public.pet_queue_services;
create policy pet_queue_services_auth_delete
on public.pet_queue_services
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
