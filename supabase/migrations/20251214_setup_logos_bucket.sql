-- Setup Logos Storage Bucket
-- 1. Create Bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Logos Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Logos Tenant Upload" ON storage.objects;
DROP POLICY IF EXISTS "Logos Tenant Update" ON storage.objects;
DROP POLICY IF EXISTS "Logos Tenant Delete" ON storage.objects;

-- 3. Create Policies

-- Public Read: Anyone can view logos
CREATE POLICY "Logos Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

-- Tenant Upload: Authenticated users can upload to their own folder (or any folder if we keep it simple, but folder restriction is better)
-- Path convention: user_id/filename
CREATE POLICY "Logos Tenant Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Tenant Update: Users can replace their own logos
CREATE POLICY "Logos Tenant Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Tenant Delete: Users can delete their own logos
CREATE POLICY "Logos Tenant Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text );
