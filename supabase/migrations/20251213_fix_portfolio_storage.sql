-- 1. Fix Portfolio Table Schema
alter table portfolio 
add column if not exists tenant_id uuid references auth.users(id) default auth.uid();

create index if not exists portfolio_tenant_idx on portfolio(tenant_id);

-- 2. Add RLS Policies for Portfolio Table
-- Allow Insert
drop policy if exists "Tenants can insert own styles" on portfolio;
create policy "Tenants can insert own styles" 
on portfolio for insert 
to authenticated 
with check ( (tenant_id = auth.uid()) OR (auth.uid() = tenant_id) );

-- Allow Delete
drop policy if exists "Tenants can delete own styles" on portfolio;
create policy "Tenants can delete own styles" 
on portfolio for delete 
to authenticated 
using ( tenant_id = auth.uid() );

-- Allow Update (if needed later)
drop policy if exists "Tenants can update own styles" on portfolio;
create policy "Tenants can update own styles" 
on portfolio for update 
to authenticated 
using ( tenant_id = auth.uid() );

-- 3. Configure Storage Bucket
-- Attempt to create bucket if it doesn't exist (Supabase Storage is partially separate, but we can try inserting if permissions allow, otherwise User acts via Dashboard)
-- NOTE: In many Supabase setups, you must create the bucket in the Dashboard. 
-- However, we can insert into storage.buckets if we are superuser (postgres).
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

-- 4. Storage RLS Policies
-- Allow Public Read
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'portfolio' );

-- Allow Tenant Upload (Insert)
-- Checks if the path starts with their user ID (folder isolation)
drop policy if exists "Tenant Upload" on storage.objects;
create policy "Tenant Upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portfolio' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow Tenant Delete
drop policy if exists "Tenant Delete" on storage.objects;
create policy "Tenant Delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portfolio' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
