-- 1. Create Storage Bucket for Logos
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 2. Storage Policies for 'logos'
-- Allow public access to view logos
create policy "Public Access to Logos"
on storage.objects for select
using ( bucket_id = 'logos' );

-- Allow authenticated users to upload logos
create policy "Authenticated Users can Upload Logos"
on storage.objects for insert
with check ( bucket_id = 'logos' and auth.role() = 'authenticated' );

-- Allow users to update their own logos (assuming folder structure is user_id/filename)
create policy "Users can update own logos"
on storage.objects for update
using ( bucket_id = 'logos' and auth.uid()::text = (storage.foldername(name))[1] );

-- 3. Update Profiles Table Schema
alter table profiles 
add column if not exists primary_color text default '#22c55e',
add column if not exists shop_name text,
add column if not exists logo_url text;
