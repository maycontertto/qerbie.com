-- Qerbie / Supabase Schema
-- Version: 021_merchant_attendants
-- Purpose: Support attendant accounts (via merchant_members) + invite codes to link attendants to a merchant.
-- Depends on: 002_merchants

begin;

-- Extend merchant_members with basic profile fields.
alter table public.merchant_members
  add column if not exists display_name text,
  add column if not exists login text,
  add column if not exists avatar_url text;

-- Optional: unique login per merchant (when provided).
create unique index if not exists merchant_members_merchant_login_ux
  on public.merchant_members (merchant_id, login)
  where login is not null;

-- Invite codes (owner creates, attendant redeems).
create table if not exists public.merchant_invites (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  role public.merchant_member_role not null default 'staff',
  code text not null,
  login text,
  display_name text,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_invites_code_length_chk check (char_length(code) >= 6 and char_length(code) <= 32),
  constraint merchant_invites_counts_chk check (max_uses >= 1 and used_count >= 0 and used_count <= max_uses)
);

create unique index if not exists merchant_invites_code_ux on public.merchant_invites (code);
create index if not exists merchant_invites_merchant_id_ix on public.merchant_invites (merchant_id);

drop trigger if exists set_updated_at on public.merchant_invites;
create trigger set_updated_at
before update on public.merchant_invites
for each row
execute function public.set_updated_at();

-- Redeem invite code → creates merchant_members row for the authenticated user.
create or replace function public.redeem_merchant_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.merchant_invites;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
    into v_inv
  from public.merchant_invites
  where code = p_code
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    raise exception 'invalid_code';
  end if;

  if v_inv.used_count >= v_inv.max_uses then
    raise exception 'code_used';
  end if;

  insert into public.merchant_members (merchant_id, user_id, role, display_name, login)
  values (
    v_inv.merchant_id,
    auth.uid(),
    v_inv.role,
    nullif(coalesce(v_inv.display_name, v_inv.login), ''),
    nullif(v_inv.login, '')
  )
  on conflict (merchant_id, user_id)
  do update set
    role = excluded.role,
    display_name = coalesce(public.merchant_members.display_name, excluded.display_name),
    login = coalesce(public.merchant_members.login, excluded.login),
    updated_at = now();

  update public.merchant_invites
    set used_count = used_count + 1,
        updated_at = now()
  where id = v_inv.id;

  return v_inv.merchant_id;
end;
$$;

revoke all on function public.redeem_merchant_invite(text) from public;
grant execute on function public.redeem_merchant_invite(text) to authenticated;

commit;
