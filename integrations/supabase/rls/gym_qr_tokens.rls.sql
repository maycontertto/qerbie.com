-- Qerbie / Supabase RLS Policies
-- Table: public.gym_qr_tokens

begin;

alter table public.gym_qr_tokens enable row level security;
alter table public.gym_qr_tokens force row level security;

revoke all on table public.gym_qr_tokens from anon;
revoke all on table public.gym_qr_tokens from authenticated;

grant select on table public.gym_qr_tokens to anon;
grant select, insert, update, delete on table public.gym_qr_tokens to authenticated;

-- Anon: allow resolving QR token (only active)
drop policy if exists gym_qr_tokens_anon_select on public.gym_qr_tokens;
create policy gym_qr_tokens_anon_select
on public.gym_qr_tokens
for select
to anon
using (is_active = true);

-- Authenticated: merchant staff

drop policy if exists gym_qr_tokens_auth_select on public.gym_qr_tokens;
create policy gym_qr_tokens_auth_select
on public.gym_qr_tokens
for select
to authenticated
using (public.has_merchant_access(merchant_id));

drop policy if exists gym_qr_tokens_auth_insert on public.gym_qr_tokens;
create policy gym_qr_tokens_auth_insert
on public.gym_qr_tokens
for insert
to authenticated
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_qr_tokens_auth_update on public.gym_qr_tokens;
create policy gym_qr_tokens_auth_update
on public.gym_qr_tokens
for update
to authenticated
using (public.has_merchant_access(merchant_id))
with check (public.has_merchant_access(merchant_id));

drop policy if exists gym_qr_tokens_auth_delete on public.gym_qr_tokens;
create policy gym_qr_tokens_auth_delete
on public.gym_qr_tokens
for delete
to authenticated
using (public.is_merchant_owner(merchant_id));

commit;
