-- Qerbie / Supabase RLS Policies
-- Table: public.carwash_services

begin;

alter table public.carwash_services enable row level security;
alter table public.carwash_services force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.carwash_services from anon;
revoke all on table public.carwash_services from authenticated;

grant select on table public.carwash_services to anon;
grant select, insert, update, delete on table public.carwash_services to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customers can list only active services, scoped by the scanned QR token.
drop policy if exists carwash_services_anon_select on public.carwash_services;
create policy carwash_services_anon_select
on public.carwash_services
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.carwash_qr_tokens t
    where t.qr_token = (current_setting('request.headers', true)::json ->> 'x-carwash-qr-token')
      and t.is_active = true
      and t.merchant_id = carwash_services.merchant_id
  )
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists carwash_services_auth_select on public.carwash_services;
create policy carwash_services_auth_select
on public.carwash_services
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists carwash_services_auth_insert on public.carwash_services;
create policy carwash_services_auth_insert
on public.carwash_services
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists carwash_services_auth_update on public.carwash_services;
create policy carwash_services_auth_update
on public.carwash_services
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists carwash_services_auth_delete on public.carwash_services;
create policy carwash_services_auth_delete
on public.carwash_services
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
