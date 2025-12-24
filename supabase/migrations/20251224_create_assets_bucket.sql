-- Create a new storage bucket for tenant assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Tenants can upload to their own folder (folder name regex matching their user ID?)
-- Best practice: User uploads to /USER_ID/FOLDER_NAME/FILE

-- 1. Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Allow authenticated users to read their own files
CREATE POLICY "Users can view their own assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tenant-assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow users to update/delete their own files
CREATE POLICY "Users can update their own assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-assets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
