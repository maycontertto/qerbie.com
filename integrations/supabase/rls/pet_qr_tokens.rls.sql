-- Qerbie / Supabase RLS Policies
-- Table: public.pet_qr_tokens

begin;

alter table public.pet_qr_tokens enable row level security;
alter table public.pet_qr_tokens force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.pet_qr_tokens from anon;
revoke all on table public.pet_qr_tokens from authenticated;

grant select on table public.pet_qr_tokens to anon;
grant select, insert, update, delete on table public.pet_qr_tokens to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customers can read ONLY the QR row that matches the scanned token.
drop policy if exists pet_qr_tokens_anon_select on public.pet_qr_tokens;
create policy pet_qr_tokens_anon_select
on public.pet_qr_tokens
for select
to anon
using (
  qr_token = (current_setting('request.headers', true)::json ->> 'x-pet-qr-token')
  and is_active = true
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists pet_qr_tokens_auth_select on public.pet_qr_tokens;
create policy pet_qr_tokens_auth_select
on public.pet_qr_tokens
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists pet_qr_tokens_auth_insert on public.pet_qr_tokens;
create policy pet_qr_tokens_auth_insert
on public.pet_qr_tokens
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists pet_qr_tokens_auth_update on public.pet_qr_tokens;
create policy pet_qr_tokens_auth_update
on public.pet_qr_tokens
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists pet_qr_tokens_auth_delete on public.pet_qr_tokens;
create policy pet_qr_tokens_auth_delete
on public.pet_qr_tokens
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
