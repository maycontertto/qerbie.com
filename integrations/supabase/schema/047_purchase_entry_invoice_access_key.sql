-- Qerbie / Supabase Schema
-- Version: 047_purchase_entry_invoice_access_key
-- Purpose: Guarda a chave de acesso da NF-e nas entradas de compra para busca e futuras integrações.
-- Depends on: 046_purchase_entries

begin;

alter table public.purchase_entries
  add column if not exists invoice_access_key text;

alter table public.purchase_entries
  drop constraint if exists purchase_entries_invoice_access_key_chk;

alter table public.purchase_entries
  add constraint purchase_entries_invoice_access_key_chk
  check (invoice_access_key is null or invoice_access_key ~ '^\d{44}$');

create index if not exists purchase_entries_merchant_access_key_ix
  on public.purchase_entries (merchant_id, invoice_access_key)
  where invoice_access_key is not null;

drop function if exists public.record_purchase_entry(uuid, uuid, text, text, date, date, text, jsonb);

create or replace function public.record_purchase_entry(
  p_merchant_id uuid,
  p_supplier_id uuid default null,
  p_supplier_name text default null,
  p_invoice_number text default null,
  p_invoice_access_key text default null,
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
  v_invoice_access_key_trimmed text := nullif(regexp_replace(coalesce(p_invoice_access_key, ''), '\D', '', 'g'), '');
begin
  if not public.is_merchant_owner(p_merchant_id) then
    raise exception 'not_owner';
  end if;

  if v_invoice_number_trimmed is null then
    raise exception 'invalid_invoice_number';
  end if;

  if v_invoice_access_key_trimmed is not null and char_length(v_invoice_access_key_trimmed) <> 44 then
    raise exception 'invalid_invoice_access_key';
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
    invoice_access_key,
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
    v_invoice_access_key_trimmed,
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

revoke all on function public.record_purchase_entry(uuid, uuid, text, text, text, date, date, text, jsonb) from public;
grant execute on function public.record_purchase_entry(uuid, uuid, text, text, text, date, date, text, jsonb) to authenticated;

commit;
