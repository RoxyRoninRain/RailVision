-- FORCE FIX: Portfolio & Storage
-- Run this in Supabase SQL Editor

-- 1. Force Public Bucket (Update if exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Add tenant_id column if missing (Safe)
ALTER TABLE portfolio 
ADD COLUMN IF NOT EXISTS tenant_id uuid DEFAULT auth.uid(),
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 3. Fix Permissions (Drop and Recreate to be sure)
DROP POLICY IF EXISTS "Portfolio Public Read" ON storage.objects;
DROP POLICY IF EXISTS "Portfolio Tenant Upload" ON storage.objects;
DROP POLICY IF EXISTS "Portfolio Tenant Delete" ON storage.objects;

CREATE POLICY "Portfolio Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'portfolio' );

CREATE POLICY "Portfolio Tenant Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'portfolio' ); 

CREATE POLICY "Portfolio Tenant Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'portfolio' );
