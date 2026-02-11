-- Qerbie / Supabase RLS Policies
-- Table: public.pet_profiles

begin;

alter table public.pet_profiles enable row level security;
alter table public.pet_profiles force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.pet_profiles from anon;
revoke all on table public.pet_profiles from authenticated;

grant select, insert, update, delete on table public.pet_profiles to authenticated;

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists pet_profiles_auth_select on public.pet_profiles;
create policy pet_profiles_auth_select
on public.pet_profiles
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists pet_profiles_auth_insert on public.pet_profiles;
create policy pet_profiles_auth_insert
on public.pet_profiles
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists pet_profiles_auth_update on public.pet_profiles;
create policy pet_profiles_auth_update
on public.pet_profiles
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists pet_profiles_auth_delete on public.pet_profiles;
create policy pet_profiles_auth_delete
on public.pet_profiles
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
