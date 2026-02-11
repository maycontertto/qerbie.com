-- Qerbie / Supabase RLS Policies
-- Table: public.carwash_vehicle_profiles

begin;

alter table public.carwash_vehicle_profiles enable row level security;
alter table public.carwash_vehicle_profiles force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.carwash_vehicle_profiles from anon;
revoke all on table public.carwash_vehicle_profiles from authenticated;

grant select, insert, update, delete on table public.carwash_vehicle_profiles to authenticated;

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists carwash_vehicle_profiles_auth_select on public.carwash_vehicle_profiles;
create policy carwash_vehicle_profiles_auth_select
on public.carwash_vehicle_profiles
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists carwash_vehicle_profiles_auth_insert on public.carwash_vehicle_profiles;
create policy carwash_vehicle_profiles_auth_insert
on public.carwash_vehicle_profiles
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists carwash_vehicle_profiles_auth_update on public.carwash_vehicle_profiles;
create policy carwash_vehicle_profiles_auth_update
on public.carwash_vehicle_profiles
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists carwash_vehicle_profiles_auth_delete on public.carwash_vehicle_profiles;
create policy carwash_vehicle_profiles_auth_delete
on public.carwash_vehicle_profiles
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
