-- Qerbie / Supabase RLS Policies
-- Table: public.order_items

begin;

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.order_items from anon;
revoke all on table public.order_items from authenticated;

grant select, insert on table public.order_items to anon;
grant select, insert, update, delete on table public.order_items to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customer can read items of their own orders.
-- Uses a sub-select on orders filtered by session_token.
drop policy if exists order_items_anon_select on public.order_items;
create policy order_items_anon_select
on public.order_items
for select
to anon
using (
  order_id in (
    select o.id
    from public.orders o
    where o.session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
  )
);

-- Customer can insert items (part of placing an order).
drop policy if exists order_items_anon_insert on public.order_items;
create policy order_items_anon_insert
on public.order_items
for insert
to anon
with check (
  order_id in (
    select o.id
    from public.orders o
    where o.session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
      and o.status = 'pending'
  )
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists order_items_auth_select on public.order_items;
create policy order_items_auth_select
on public.order_items
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists order_items_auth_insert on public.order_items;
create policy order_items_auth_insert
on public.order_items
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists order_items_auth_update on public.order_items;
create policy order_items_auth_update
on public.order_items
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists order_items_auth_delete on public.order_items;
create policy order_items_auth_delete
on public.order_items
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
