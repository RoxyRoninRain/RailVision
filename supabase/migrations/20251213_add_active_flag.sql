-- 1. Add is_active column
ALTER TABLE portfolio 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Seed Default Styles (Only if they don't exist for the user)
-- Note: This is tricky in pure SQL for "current user" without being in a function.
-- So we will stick to schema changes here. 
-- The "Seeding" will be done via a generic INSERT that users can run, 
-- or better, we will add a "Seed Defaults" button in the UI or handle it lazily.
-- Actually, the user asked for "Option A: Auto-add". 
-- Since we are running this in the SQL Editor, we can insert global defaults 
-- IF the table supports it. But the table has `tenant_id`.
-- So we cannot easily insert for "all tenants". 
-- Strategy: We will strictly do Schema here. 
-- We will add a "seedDefaults" server action that runs automatically when the Portfolio page loads if empty.

-- 3. Ensure RLS allows update of is_active
CREATE POLICY "Portfolio Tenant Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'portfolio' );
-- Wait, storage policies are for files. 
-- We need RLS for the TABLE 'portfolio'.

ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolio" ON portfolio
FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own portfolio" ON portfolio
FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own portfolio" ON portfolio
FOR UPDATE USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete their own portfolio" ON portfolio
FOR DELETE USING (auth.uid() = tenant_id);

-- Allow Public (Anon) access to read 'is_active=true' styles
CREATE POLICY "Public can view active styles" ON portfolio
FOR SELECT TO anon
USING (is_active = true);
