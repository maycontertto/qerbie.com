-- Qerbie / Supabase Schema
-- Version: 031_stock_auto_deduct
-- Purpose: Automatically decrement product stock when order_items are inserted.
-- Depends on: 006_orders (order_items), 028_stock (track_stock/stock_quantity)

begin;

create or replace function public.decrement_product_stock_from_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only affects items with stock tracking enabled.
  -- Does NOT block orders (stock may go negative over time).
  update public.products
     set stock_quantity = stock_quantity - new.quantity
   where id = new.product_id
     and merchant_id = new.merchant_id
     and track_stock = true;

  return new;
end;
$$;

drop trigger if exists order_items_decrement_stock on public.order_items;
create trigger order_items_decrement_stock
after insert on public.order_items
for each row
execute function public.decrement_product_stock_from_order_item();

commit;
