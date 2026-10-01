-- Qerbie / Schema 063: isolate shared catalog tables by business segment.
-- Legacy rows are assigned to the merchant's current segment; this preserves
-- access without deleting or guessing the origin of existing catalog data.

begin;

alter table public.menus
  add column if not exists business_category text;
alter table public.menu_categories
  add column if not exists business_category text;
alter table public.products
  add column if not exists business_category text;

update public.menus m
set business_category = merchant.business_category
from public.merchants merchant
where merchant.id = m.merchant_id
  and m.business_category is distinct from merchant.business_category;

update public.menu_categories category
set business_category = menu.business_category
from public.menus menu
where menu.id = category.menu_id
  and menu.merchant_id = category.merchant_id
  and category.business_category is distinct from menu.business_category;

update public.products product
set business_category = menu.business_category
from public.menus menu
where menu.id = product.menu_id
  and menu.merchant_id = product.merchant_id
  and product.business_category is distinct from menu.business_category;

create index if not exists menus_merchant_segment_ix
  on public.menus (merchant_id, business_category, is_active, display_order);
create index if not exists menu_categories_merchant_segment_ix
  on public.menu_categories (merchant_id, business_category, menu_id, is_active);
create index if not exists products_merchant_segment_ix
  on public.products (merchant_id, business_category, menu_id, is_active);

alter table public.menus drop constraint if exists menus_merchant_slug_ux;
create unique index if not exists menus_merchant_segment_slug_ux
  on public.menus (merchant_id, coalesce(business_category, ''), slug);

create or replace function public.assign_menu_business_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  merchant_category text;
begin
  if tg_op = 'UPDATE' and new.business_category is distinct from old.business_category then
    raise exception 'catalog_segment_immutable' using errcode = '23514';
  end if;

  select business_category into merchant_category
  from public.merchants
  where id = new.merchant_id;

  if not found then
    raise exception 'catalog_merchant_not_found' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    new.business_category := merchant_category;
  elsif new.business_category is distinct from merchant_category then
    raise exception 'catalog_segment_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.assign_category_business_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  menu_category text;
  menu_merchant uuid;
begin
  if tg_op = 'UPDATE' and new.business_category is distinct from old.business_category then
    raise exception 'catalog_segment_immutable' using errcode = '23514';
  end if;

  select business_category, merchant_id into menu_category, menu_merchant
  from public.menus
  where id = new.menu_id;

  if not found or menu_merchant is distinct from new.merchant_id then
    raise exception 'catalog_menu_mismatch' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.business_category := menu_category;
  elsif new.business_category is distinct from menu_category then
    raise exception 'catalog_segment_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.assign_product_business_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  menu_category text;
  menu_merchant uuid;
  category_segment text;
begin
  if tg_op = 'UPDATE' and new.business_category is distinct from old.business_category then
    raise exception 'catalog_segment_immutable' using errcode = '23514';
  end if;

  select business_category, merchant_id into menu_category, menu_merchant
  from public.menus
  where id = new.menu_id;

  if not found or menu_merchant is distinct from new.merchant_id then
    raise exception 'catalog_menu_mismatch' using errcode = '23514';
  end if;

  if new.category_id is not null then
    select business_category into category_segment
    from public.menu_categories
    where id = new.category_id
      and menu_id = new.menu_id
      and merchant_id = new.merchant_id;
    if not found or category_segment is distinct from menu_category then
      raise exception 'catalog_category_mismatch' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.business_category := menu_category;
  elsif new.business_category is distinct from menu_category then
    raise exception 'catalog_segment_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists menus_assign_business_category on public.menus;
create trigger menus_assign_business_category
before insert or update of merchant_id, business_category on public.menus
for each row execute function public.assign_menu_business_category();

drop trigger if exists menu_categories_assign_business_category on public.menu_categories;
create trigger menu_categories_assign_business_category
before insert or update of merchant_id, menu_id, business_category on public.menu_categories
for each row execute function public.assign_category_business_category();

drop trigger if exists products_assign_business_category on public.products;
create trigger products_assign_business_category
before insert or update of merchant_id, menu_id, category_id, business_category on public.products
for each row execute function public.assign_product_business_category();

create or replace function public.has_merchant_catalog_segment(
  p_merchant_id uuid,
  p_business_category text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_merchant_access(p_merchant_id)
    and exists (
      select 1
      from public.merchants merchant
      where merchant.id = p_merchant_id
        and merchant.business_category is not distinct from p_business_category
    );
$$;

revoke all on function public.has_merchant_catalog_segment(uuid, text) from public;
grant execute on function public.has_merchant_catalog_segment(uuid, text) to authenticated;

create or replace function public.has_merchant_product_catalog_segment(
  p_merchant_id uuid,
  p_product_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.products product
    where product.id = p_product_id
      and product.merchant_id = p_merchant_id
      and public.has_merchant_catalog_segment(product.merchant_id, product.business_category)
  );
$$;

revoke all on function public.has_merchant_product_catalog_segment(uuid, uuid) from public;
grant execute on function public.has_merchant_product_catalog_segment(uuid, uuid) to authenticated;

-- Only expose the active segment's catalog through authenticated dashboard access.
drop policy if exists menus_auth_select on public.menus;
create policy menus_auth_select on public.menus for select to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists menus_auth_insert on public.menus;
create policy menus_auth_insert on public.menus for insert to authenticated
with check (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists menus_auth_update on public.menus;
create policy menus_auth_update on public.menus for update to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category))
with check (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists menus_auth_delete on public.menus;
create policy menus_auth_delete on public.menus for delete to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category) and public.is_merchant_owner(merchant_id));

drop policy if exists menu_categories_auth_select on public.menu_categories;
create policy menu_categories_auth_select on public.menu_categories for select to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists menu_categories_auth_insert on public.menu_categories;
create policy menu_categories_auth_insert on public.menu_categories for insert to authenticated
with check (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists menu_categories_auth_update on public.menu_categories;
create policy menu_categories_auth_update on public.menu_categories for update to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category))
with check (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists menu_categories_auth_delete on public.menu_categories;
create policy menu_categories_auth_delete on public.menu_categories for delete to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category) and public.is_merchant_owner(merchant_id));

drop policy if exists products_auth_select on public.products;
create policy products_auth_select on public.products for select to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists products_auth_insert on public.products;
create policy products_auth_insert on public.products for insert to authenticated
with check (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists products_auth_update on public.products;
create policy products_auth_update on public.products for update to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category))
with check (public.has_merchant_catalog_segment(merchant_id, business_category));
drop policy if exists products_auth_delete on public.products;
create policy products_auth_delete on public.products for delete to authenticated
using (public.has_merchant_catalog_segment(merchant_id, business_category) and public.is_merchant_owner(merchant_id));

-- The public QR pages use server-side admin reads after validating an active QR.
-- Revoke direct anon access to variation tables to prevent global enumeration.
revoke all on table public.product_option_groups from public, anon;
revoke all on table public.product_options from public, anon;
drop policy if exists product_option_groups_anon_select on public.product_option_groups;
drop policy if exists product_options_anon_select on public.product_options;

drop policy if exists product_option_groups_auth_select on public.product_option_groups;
create policy product_option_groups_auth_select on public.product_option_groups for select to authenticated
using (public.has_merchant_access(merchant_id) and public.has_merchant_product_catalog_segment(merchant_id, product_id));
drop policy if exists product_option_groups_auth_insert on public.product_option_groups;
create policy product_option_groups_auth_insert on public.product_option_groups for insert to authenticated
with check (public.has_merchant_access(merchant_id) and public.has_merchant_product_catalog_segment(merchant_id, product_id));
drop policy if exists product_option_groups_auth_update on public.product_option_groups;
create policy product_option_groups_auth_update on public.product_option_groups for update to authenticated
using (public.has_merchant_access(merchant_id) and public.has_merchant_product_catalog_segment(merchant_id, product_id))
with check (public.has_merchant_access(merchant_id) and public.has_merchant_product_catalog_segment(merchant_id, product_id));
drop policy if exists product_option_groups_auth_delete on public.product_option_groups;
create policy product_option_groups_auth_delete on public.product_option_groups for delete to authenticated
using (public.is_merchant_owner(merchant_id) and public.has_merchant_product_catalog_segment(merchant_id, product_id));

drop policy if exists product_options_auth_select on public.product_options;
create policy product_options_auth_select on public.product_options for select to authenticated
using (
  public.has_merchant_access(product_options.merchant_id)
  and exists (
    select 1 from public.product_option_groups option_group
    where option_group.id = product_options.option_group_id
      and option_group.merchant_id = product_options.merchant_id
      and public.has_merchant_product_catalog_segment(product_options.merchant_id, option_group.product_id)
  )
);
drop policy if exists product_options_auth_insert on public.product_options;
create policy product_options_auth_insert on public.product_options for insert to authenticated
with check (
  public.has_merchant_access(product_options.merchant_id)
  and exists (
    select 1 from public.product_option_groups option_group
    where option_group.id = product_options.option_group_id
      and option_group.merchant_id = product_options.merchant_id
      and public.has_merchant_product_catalog_segment(product_options.merchant_id, option_group.product_id)
  )
);
drop policy if exists product_options_auth_update on public.product_options;
create policy product_options_auth_update on public.product_options for update to authenticated
using (
  public.has_merchant_access(product_options.merchant_id)
  and exists (
    select 1 from public.product_option_groups option_group
    where option_group.id = product_options.option_group_id
      and option_group.merchant_id = product_options.merchant_id
      and public.has_merchant_product_catalog_segment(product_options.merchant_id, option_group.product_id)
  )
)
with check (
  public.has_merchant_access(product_options.merchant_id)
  and exists (
    select 1 from public.product_option_groups option_group
    where option_group.id = product_options.option_group_id
      and option_group.merchant_id = product_options.merchant_id
      and public.has_merchant_product_catalog_segment(product_options.merchant_id, option_group.product_id)
  )
);
drop policy if exists product_options_auth_delete on public.product_options;
create policy product_options_auth_delete on public.product_options for delete to authenticated
using (
  public.is_merchant_owner(product_options.merchant_id)
  and exists (
    select 1 from public.product_option_groups option_group
    where option_group.id = product_options.option_group_id
      and option_group.merchant_id = product_options.merchant_id
      and public.has_merchant_product_catalog_segment(product_options.merchant_id, option_group.product_id)
  )
);

commit;
