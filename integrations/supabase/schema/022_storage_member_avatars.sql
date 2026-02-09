-- Qerbie / Supabase Schema
-- Version: 022_storage_member_avatars
-- Purpose: Public bucket for attendant/member avatars + safe RLS write policies.
-- Depends on: 015_storage_product_images (merchant_id_from_storage_path), 003_menus (has_merchant_access)

begin;

-- Create bucket (idempotent). Keep public so customers/staff can see avatars.
insert into storage.buckets (id, name, public)
values ('member-avatars', 'member-avatars', true)
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

-- Read: anyone can read objects from this bucket.
drop policy if exists member_avatars_select on storage.objects;
create policy member_avatars_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'member-avatars'
);

-- Insert: authenticated user can upload avatar inside a merchant folder they have access to.
drop policy if exists member_avatars_insert on storage.objects;
create policy member_avatars_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'member-avatars'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

-- Update: uploader can update within merchant folder.
drop policy if exists member_avatars_update on storage.objects;
create policy member_avatars_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'member-avatars'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
)
with check (
  bucket_id = 'member-avatars'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

-- Delete: uploader can delete their own uploads.
drop policy if exists member_avatars_delete on storage.objects;
create policy member_avatars_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'member-avatars'
  and owner = auth.uid()
  and public.has_merchant_access(public.merchant_id_from_storage_path(name))
);

commit;
