-- Qerbie / Supabase RLS Policies
-- Table: public.merchant_queues

begin;

alter table public.merchant_queues enable row level security;
alter table public.merchant_queues force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.merchant_queues from anon;
revoke all on table public.merchant_queues from authenticated;

grant select on table public.merchant_queues to anon;
grant select, insert, update, delete on table public.merchant_queues to authenticated;

-- ── Anon ────────────────────────────────────────────────────
-- Customers can see open queues to decide whether to join.
drop policy if exists merchant_queues_anon_select on public.merchant_queues;
create policy merchant_queues_anon_select
on public.merchant_queues
for select
to anon
using (
  is_active = true and status = 'open'
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists merchant_queues_auth_select on public.merchant_queues;
create policy merchant_queues_auth_select
on public.merchant_queues
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_queues_auth_insert on public.merchant_queues;
create policy merchant_queues_auth_insert
on public.merchant_queues
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists merchant_queues_auth_update on public.merchant_queues;
create policy merchant_queues_auth_update
on public.merchant_queues
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists merchant_queues_auth_delete on public.merchant_queues;
create policy merchant_queues_auth_delete
on public.merchant_queues
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
