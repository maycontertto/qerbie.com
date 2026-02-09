-- Qerbie / Supabase Schema
-- Version: 020_storage_brand_logos
-- Purpose: Public bucket for merchant brand logos + safe RLS write policies for merchant staff.

begin;

-- Create bucket (idempotent). We keep it public so QR customers can view the logo.
insert into storage.buckets (id, name, public)
values ('brand-logos', 'brand-logos', true)
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
end;
$$;

-- Policies on storage.objects

-- Read: anyone can read objects from this bucket.
drop policy if exists brand_logos_select on storage.objects;
create policy brand_logos_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'brand-logos'
);

-- Insert: merchant staff can upload under their merchant folder.
drop policy if exists brand_logos_insert on storage.objects;
create policy brand_logos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'brand-logos'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

-- Update: merchant staff can replace/move objects under their merchant folder.
drop policy if exists brand_logos_update on storage.objects;
create policy brand_logos_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'brand-logos'
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
)
with check (
  bucket_id = 'brand-logos'
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

-- Delete: owner only (destructive).
drop policy if exists brand_logos_delete on storage.objects;
create policy brand_logos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'brand-logos'
  and public.is_merchant_owner(public.merchant_id_from_storage_path(name))
);

commit;
