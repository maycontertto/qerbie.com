-- Qerbie / Supabase Schema
-- Version: 046_purchase_entries
-- Purpose: Entrada de compras/notas com atualização em lote do estoque e histórico de movimentações.
-- Depends on: 002_merchants, 028_stock, 040_casa_racao_comercial, 045_units_and_decimal_quantities_hardening

begin;

create table if not exists public.purchase_entries (
  id                 uuid           primary key default gen_random_uuid(),
  merchant_id        uuid           not null references public.merchants(id) on delete cascade,
  supplier_id        uuid           references public.merchant_suppliers(id) on delete set null,
  supplier_name      text,
  invoice_number     text           not null,
  issue_date         date,
  entry_date         date           not null default current_date,
  notes              text,
  item_count         integer        not null default 0,
  total_amount       numeric(12,2)  not null default 0,
  created_by_user_id uuid,
  created_at         timestamptz    not null default now(),
  updated_at         timestamptz    not null default now(),

  constraint purchase_entries_invoice_number_len_chk check (char_length(btrim(invoice_number)) between 1 and 80),
  constraint purchase_entries_item_count_gte_zero_chk check (item_count >= 0),
  constraint purchase_entries_total_amount_gte_zero_chk check (total_amount >= 0)
);

create index if not exists purchase_entries_merchant_id_ix
  on public.purchase_entries (merchant_id);

create index if not exists purchase_entries_merchant_entry_date_ix
  on public.purchase_entries (merchant_id, entry_date desc, created_at desc);

create index if not exists purchase_entries_merchant_supplier_ix
  on public.purchase_entries (merchant_id, supplier_id);

drop trigger if exists set_updated_at on public.purchase_entries;
create trigger set_updated_at
before update on public.purchase_entries
for each row
execute function public.set_updated_at();

create table if not exists public.purchase_entry_items (
  id                 uuid           primary key default gen_random_uuid(),
  purchase_entry_id  uuid           not null references public.purchase_entries(id) on delete cascade,
  merchant_id        uuid           not null references public.merchants(id) on delete cascade,
  product_id         uuid           not null references public.products(id) on delete restrict,
  product_name       text           not null,
  barcode_snapshot   text,
  unit_label         text           not null default 'un',
  quantity           numeric(12,3)  not null,
  unit_cost          numeric(12,2)  not null,
  line_total         numeric(12,2)  not null,
  created_at         timestamptz    not null default now(),

  constraint purchase_entry_items_quantity_gt_zero_chk check (quantity > 0),
  constraint purchase_entry_items_unit_cost_gte_zero_chk check (unit_cost >= 0),
  constraint purchase_entry_items_line_total_gte_zero_chk check (line_total >= 0)
);

create index if not exists purchase_entry_items_entry_id_ix
  on public.purchase_entry_items (purchase_entry_id);

create index if not exists purchase_entry_items_merchant_product_ix
  on public.purchase_entry_items (merchant_id, product_id);

create table if not exists public.stock_movements (
  id                 uuid           primary key default gen_random_uuid(),
  merchant_id        uuid           not null references public.merchants(id) on delete cascade,
  product_id         uuid           not null references public.products(id) on delete cascade,
  movement_type      text           not null,
  source_type        text,
  source_id          uuid,
  quantity_delta     numeric(12,3)  not null,
  before_quantity    numeric(12,3)  not null default 0,
  after_quantity     numeric(12,3)  not null default 0,
  unit_cost          numeric(12,2),
  notes              text,
  created_by_user_id uuid,
  created_at         timestamptz    not null default now(),

  constraint stock_movements_movement_type_chk check (
    movement_type in ('purchase_entry', 'sale', 'manual_adjustment', 'return')
  )
);

create index if not exists stock_movements_merchant_product_created_ix
  on public.stock_movements (merchant_id, product_id, created_at desc);

create index if not exists stock_movements_source_ix
  on public.stock_movements (source_type, source_id);

create or replace function public.record_purchase_entry(
  p_merchant_id uuid,
  p_supplier_id uuid default null,
  p_supplier_name text default null,
  p_invoice_number text default null,
  p_issue_date date default null,
  p_entry_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid := gen_random_uuid();
  v_effective_supplier_id uuid := null;
  v_effective_supplier_name text := null;
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_qty numeric(12,3);
  v_unit_cost numeric(12,2);
  v_line_total numeric(12,2);
  v_before_qty numeric(12,3);
  v_after_qty numeric(12,3);
  v_new_avg_cost numeric(12,2);
  v_total_amount numeric(12,2) := 0;
  v_item_count integer := 0;
  v_supplier_name_trimmed text := nullif(btrim(coalesce(p_supplier_name, '')), '');
  v_invoice_number_trimmed text := nullif(btrim(coalesce(p_invoice_number, '')), '');
begin
  if not public.is_merchant_owner(p_merchant_id) then
    raise exception 'not_owner';
  end if;

  if v_invoice_number_trimmed is null then
    raise exception 'invalid_invoice_number';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  if p_supplier_id is not null then
    select s.id, s.name
      into v_effective_supplier_id, v_effective_supplier_name
      from public.merchant_suppliers s
     where s.id = p_supplier_id
       and s.merchant_id = p_merchant_id
     limit 1;

    if v_effective_supplier_id is null then
      raise exception 'invalid_supplier';
    end if;
  elsif v_supplier_name_trimmed is not null then
    select s.id, s.name
      into v_effective_supplier_id, v_effective_supplier_name
      from public.merchant_suppliers s
     where s.merchant_id = p_merchant_id
       and lower(btrim(s.name)) = lower(v_supplier_name_trimmed)
     order by s.created_at asc
     limit 1;

    if v_effective_supplier_id is null then
      insert into public.merchant_suppliers (merchant_id, name)
      values (p_merchant_id, v_supplier_name_trimmed)
      returning id, name into v_effective_supplier_id, v_effective_supplier_name;
    end if;
  end if;

  insert into public.purchase_entries (
    id,
    merchant_id,
    supplier_id,
    supplier_name,
    invoice_number,
    issue_date,
    entry_date,
    notes,
    item_count,
    total_amount,
    created_by_user_id
  ) values (
    v_entry_id,
    p_merchant_id,
    v_effective_supplier_id,
    coalesce(v_effective_supplier_name, v_supplier_name_trimmed),
    v_invoice_number_trimmed,
    p_issue_date,
    coalesce(p_entry_date, current_date),
    nullif(btrim(coalesce(p_notes, '')), ''),
    0,
    0,
    auth.uid()
  );

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_qty := round(coalesce((v_item ->> 'quantity')::numeric, 0)::numeric, 3);
    v_unit_cost := round(coalesce((v_item ->> 'unit_cost')::numeric, 0)::numeric, 2);

    if v_product_id is null or v_qty <= 0 or v_unit_cost < 0 then
      raise exception 'invalid_items';
    end if;

    select
      p.id,
      p.name,
      p.barcode,
      p.unit_label,
      coalesce(p.stock_quantity, 0)::numeric(12,3) as stock_quantity,
      coalesce(p.avg_cost, 0)::numeric(12,2) as avg_cost
      into v_product
      from public.products p
     where p.id = v_product_id
       and p.merchant_id = p_merchant_id
     for update;

    if not found then
      raise exception 'invalid_product';
    end if;

    v_before_qty := coalesce(v_product.stock_quantity, 0);
    v_after_qty := round((v_before_qty + v_qty)::numeric, 3);
    v_line_total := round((v_qty * v_unit_cost)::numeric, 2);

    if v_after_qty <= 0 then
      v_new_avg_cost := v_unit_cost;
    elsif v_before_qty <= 0 then
      v_new_avg_cost := v_unit_cost;
    else
      v_new_avg_cost := round((((v_before_qty * coalesce(v_product.avg_cost, 0)) + (v_qty * v_unit_cost)) / v_after_qty)::numeric, 2);
    end if;

    insert into public.purchase_entry_items (
      purchase_entry_id,
      merchant_id,
      product_id,
      product_name,
      barcode_snapshot,
      unit_label,
      quantity,
      unit_cost,
      line_total
    ) values (
      v_entry_id,
      p_merchant_id,
      v_product.id,
      v_product.name,
      v_product.barcode,
      coalesce(nullif(btrim(v_product.unit_label), ''), 'un'),
      v_qty,
      v_unit_cost,
      v_line_total
    );

    update public.products
       set track_stock = true,
           stock_quantity = v_after_qty,
           cost_price = v_unit_cost,
           avg_cost = greatest(v_new_avg_cost, 0),
           supplier_id = coalesce(v_effective_supplier_id, supplier_id)
     where id = v_product.id
       and merchant_id = p_merchant_id;

    insert into public.stock_movements (
      merchant_id,
      product_id,
      movement_type,
      source_type,
      source_id,
      quantity_delta,
      before_quantity,
      after_quantity,
      unit_cost,
      notes,
      created_by_user_id
    ) values (
      p_merchant_id,
      v_product.id,
      'purchase_entry',
      'purchase_entry',
      v_entry_id,
      v_qty,
      v_before_qty,
      v_after_qty,
      v_unit_cost,
      concat('Entrada da nota ', v_invoice_number_trimmed),
      auth.uid()
    );

    v_item_count := v_item_count + 1;
    v_total_amount := round((v_total_amount + v_line_total)::numeric, 2);
  end loop;

  update public.purchase_entries
     set item_count = v_item_count,
         total_amount = v_total_amount
   where id = v_entry_id;

  return v_entry_id;
end;
$$;

revoke all on function public.record_purchase_entry(uuid, uuid, text, text, date, date, text, jsonb) from public;
grant execute on function public.record_purchase_entry(uuid, uuid, text, text, date, date, text, jsonb) to authenticated;

commit;
