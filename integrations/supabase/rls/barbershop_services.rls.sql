-- Qerbie / Supabase RLS Policies
-- Table: public.barbershop_services

begin;

alter table public.barbershop_services enable row level security;
alter table public.barbershop_services force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.barbershop_services from anon;
revoke all on table public.barbershop_services from authenticated;

grant select on table public.barbershop_services to anon;
grant select, insert, update, delete on table public.barbershop_services to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customers can list only active services.
drop policy if exists barbershop_services_anon_select on public.barbershop_services;
create policy barbershop_services_anon_select
on public.barbershop_services
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.barbershop_qr_tokens t
    where t.qr_token = (current_setting('request.headers', true)::json ->> 'x-barbershop-qr-token')
      and t.is_active = true
      and t.merchant_id = barbershop_services.merchant_id
  )
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists barbershop_services_auth_select on public.barbershop_services;
create policy barbershop_services_auth_select
on public.barbershop_services
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists barbershop_services_auth_insert on public.barbershop_services;
create policy barbershop_services_auth_insert
on public.barbershop_services
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists barbershop_services_auth_update on public.barbershop_services;
create policy barbershop_services_auth_update
on public.barbershop_services
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists barbershop_services_auth_delete on public.barbershop_services;
create policy barbershop_services_auth_delete
on public.barbershop_services
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
