-- Qerbie / Supabase RLS Policies
-- Table: public.queue_tickets

begin;

alter table public.queue_tickets enable row level security;
alter table public.queue_tickets force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.queue_tickets from anon;
revoke all on table public.queue_tickets from authenticated;

-- Anon can read (see their position) and insert (take a number).
grant select, insert on table public.queue_tickets to anon;
-- Staff can fully manage.
grant select, insert, update, delete on table public.queue_tickets to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customers can see tickets in a queue (position board / "painel").
-- Only non-terminal tickets shown.
drop policy if exists queue_tickets_anon_select on public.queue_tickets;
create policy queue_tickets_anon_select
on public.queue_tickets
for select
to anon
using (
  status in ('waiting', 'called', 'serving')
);

-- Customers can take a number (insert a ticket with status=waiting).
drop policy if exists queue_tickets_anon_insert on public.queue_tickets;
create policy queue_tickets_anon_insert
on public.queue_tickets
for insert
to anon
with check (
  status = 'waiting'
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists queue_tickets_auth_select on public.queue_tickets;
create policy queue_tickets_auth_select
on public.queue_tickets
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists queue_tickets_auth_insert on public.queue_tickets;
create policy queue_tickets_auth_insert
on public.queue_tickets
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists queue_tickets_auth_update on public.queue_tickets;
create policy queue_tickets_auth_update
on public.queue_tickets
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists queue_tickets_auth_delete on public.queue_tickets;
create policy queue_tickets_auth_delete
on public.queue_tickets
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
