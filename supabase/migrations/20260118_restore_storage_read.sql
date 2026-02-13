-- Restore public read access to quote-uploads bucket
-- This fixes the issue where generated images appear as broken links

BEGIN;

-- 1. Ensure the bucket is public (optional, but good for clarity)
UPDATE storage.buckets
SET public = true
WHERE id = 'quote-uploads';

-- 2. Drop any conflicting read policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to quote-uploads" ON storage.objects;

-- 3. Create a clear Public Read policy
CREATE POLICY "Public Read quote-uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'quote-uploads');

COMMIT;
