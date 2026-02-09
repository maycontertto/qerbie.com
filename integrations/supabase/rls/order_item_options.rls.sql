-- Qerbie / Supabase RLS Policies
-- Table: public.order_item_options

begin;

alter table public.order_item_options enable row level security;
alter table public.order_item_options force row level security;

-- ── Grants ──────────────────────────────────────────────────
revoke all on table public.order_item_options from anon;
revoke all on table public.order_item_options from authenticated;

grant select, insert on table public.order_item_options to anon;
grant select, insert, update, delete on table public.order_item_options to authenticated;

-- ── Anon (customers) ────────────────────────────────────────
-- Customer can read options of their own order items.
drop policy if exists order_item_options_anon_select on public.order_item_options;
create policy order_item_options_anon_select
on public.order_item_options
for select
to anon
using (
  order_item_id in (
    select oi.id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
  )
);

-- Customer can insert options as part of placing an order.
drop policy if exists order_item_options_anon_insert on public.order_item_options;
create policy order_item_options_anon_insert
on public.order_item_options
for insert
to anon
with check (
  order_item_id in (
    select oi.id
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.session_token = current_setting('request.headers', true)::json ->> 'x-session-token'
      and o.status = 'pending'
  )
);

-- ── Authenticated (merchant staff) ─────────────────────────
drop policy if exists order_item_options_auth_select on public.order_item_options;
create policy order_item_options_auth_select
on public.order_item_options
for select
to authenticated
using (
  public.has_merchant_access(merchant_id)
);

drop policy if exists order_item_options_auth_insert on public.order_item_options;
create policy order_item_options_auth_insert
on public.order_item_options
for insert
to authenticated
with check (
  public.has_merchant_access(merchant_id)
);

drop policy if exists order_item_options_auth_update on public.order_item_options;
create policy order_item_options_auth_update
on public.order_item_options
for update
to authenticated
using (
  public.has_merchant_access(merchant_id)
)
with check (
  public.has_merchant_access(merchant_id)
);

-- Delete: owner only.
drop policy if exists order_item_options_auth_delete on public.order_item_options;
create policy order_item_options_auth_delete
on public.order_item_options
for delete
to authenticated
using (
  public.is_merchant_owner(merchant_id)
);

commit;
