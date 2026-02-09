-- Qerbie / Supabase Schema
-- Version: 025_member_job_titles
-- Purpose: Add staff job title/category to invites and members.
-- Depends on: 021_merchant_attendants

begin;

alter table public.merchant_members
  add column if not exists job_title text;

alter table public.merchant_invites
  add column if not exists job_title text;

-- Redeem invite code → creates/updates merchant_members row for the authenticated user.
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

  insert into public.merchant_members (merchant_id, user_id, role, display_name, login, job_title)
  values (
    v_inv.merchant_id,
    auth.uid(),
    v_inv.role,
    nullif(coalesce(v_inv.display_name, v_inv.login), ''),
    nullif(v_inv.login, ''),
    nullif(v_inv.job_title, '')
  )
  on conflict (merchant_id, user_id)
  do update set
    role = excluded.role,
    display_name = coalesce(public.merchant_members.display_name, excluded.display_name),
    login = coalesce(public.merchant_members.login, excluded.login),
    job_title = coalesce(public.merchant_members.job_title, excluded.job_title),
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
