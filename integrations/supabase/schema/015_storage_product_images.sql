-- Qerbie / Supabase Schema
-- Version: 015_storage_product_images
-- Purpose: Public bucket for product images + safe RLS write policies for merchant staff.

begin;

-- Create bucket (idempotent). We keep it public so QR customers can view images.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Ensure RLS is enabled for storage objects (safe if already enabled).
do $$
begin
  begin
    execute 'alter table storage.objects enable row level security';
  exception
    when insufficient_privilege then
      raise notice 'Skipping: enable RLS on storage.objects (insufficient privilege). It is usually already enabled by Supabase.';
  end;
end
$$;

-- Helper to parse merchant_id from object path: "<merchant_uuid>/..."
create or replace function public.merchant_id_from_storage_path(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

revoke all on function public.merchant_id_from_storage_path(text) from public;
grant execute on function public.merchant_id_from_storage_path(text) to anon, authenticated;

-- Policies on storage.objects
-- Note: storage schema is managed by Supabase; policies are safe to add.

-- Read: anyone can read objects from this bucket.
drop policy if exists product_images_select on storage.objects;
create policy product_images_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
);

-- Insert: merchant staff can upload under their merchant folder.
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

-- Update: merchant staff can replace/move objects under their merchant folder.
drop policy if exists product_images_update on storage.objects;
create policy product_images_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
)
with check (
  bucket_id = 'product-images'
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

-- Delete: owner only (destructive).
drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_merchant_owner(public.merchant_id_from_storage_path(name))
);

commit;
