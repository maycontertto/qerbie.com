-- Qerbie / Supabase Schema
-- Version: 023_member_permissions
-- Purpose: Per-member permissions so owner can restrict/allow accesses (e.g. gerente).
-- Depends on: 002_merchants

begin;

-- Store permission overrides (JSON) per membership.
-- Missing keys mean defaults based on role (admin=true, staff=false).
alter table public.merchant_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Permission predicate usable by RLS and app.
-- Defaults:
--  - owner: always true
--  - admin: true unless explicitly set to false
--  - staff: false unless explicitly set to true
create or replace function public.has_member_permission(p_merchant_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_merchant_owner(p_merchant_id)
    or exists (
      select 1
      from public.merchant_members mm
      where mm.merchant_id = p_merchant_id
        and mm.user_id = auth.uid()
        and (
          (mm.role = 'admin' and coalesce((mm.permissions ->> p_perm)::boolean, true))
          or
          (mm.role = 'staff' and coalesce((mm.permissions ->> p_perm)::boolean, false))
        )
    );
$$;

revoke all on function public.has_member_permission(uuid, text) from public;
grant execute on function public.has_member_permission(uuid, text) to authenticated;

commit;
