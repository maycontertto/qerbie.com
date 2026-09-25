-- Version: 059_sensitive_data_access_hardening
-- Purpose: prevent anonymous REST access to merchant/catalog records and
-- close stock movement history.

begin;

-- Merchant records can contain owner identifiers, contact details and payment
-- settings. Public QR pages validate their QR token, then read these fields
-- server-side with the service role. Raw PostgREST access is not needed.
alter table public.merchants enable row level security;
alter table public.merchants force row level security;
revoke all on table public.merchants from public, anon;
drop policy if exists merchants_anon_select on public.merchants;

-- Product, menu and category data is fetched server-side after QR validation.
-- Deny anonymous REST access to prevent cross-merchant catalog scraping.
alter table public.products enable row level security;
alter table public.products force row level security;
revoke all on table public.products from public, anon;
drop policy if exists products_anon_select on public.products;

alter table public.menus enable row level security;
alter table public.menus force row level security;
revoke all on table public.menus from public, anon;
drop policy if exists menus_anon_select on public.menus;

alter table public.menu_categories enable row level security;
alter table public.menu_categories force row level security;
revoke all on table public.menu_categories from public, anon;
drop policy if exists menu_categories_anon_select on public.menu_categories;

-- Stock movement history contains purchase costs and quantities. Current app
-- writes movements through SECURITY DEFINER purchase/stock functions and has
-- no direct client read path, so deny table access to API roles entirely.
alter table public.stock_movements enable row level security;
revoke all on table public.stock_movements from public, anon, authenticated;

commit;
