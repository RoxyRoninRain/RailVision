-- FINAL OPTIMIZATION: Profiles & Portfolio
-- Fixes remaining lints: auth_rls_initplan (profiles insert), multiple_permissive_policies (portfolio select)

-- 1. OPTIMIZE: Profiles Insert
-- Fix: Use (select auth.uid()) to prevent re-evaluation
-- Replaces "Users can insert own profile"
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles 
FOR INSERT TO authenticated 
WITH CHECK ( (select auth.uid()) = id );

-- 2. OPTIMIZE: Portfolio Policies (Remove Overlap)
-- Problem: "Tenants can manage own portfolio" (FOR ALL) overlapped with "Public can view" (FOR SELECT)
-- Solution: Split "Manage" into specific mutation policies (Insert/Update/Delete) and let Public handle Select.

DROP POLICY IF EXISTS "Tenants can manage own portfolio" ON portfolio;

-- Insert
CREATE POLICY "Tenants can insert own portfolio" ON portfolio 
FOR INSERT TO authenticated 
WITH CHECK ( (select auth.uid()) = tenant_id );

-- Update
CREATE POLICY "Tenants can update own portfolio" ON portfolio 
FOR UPDATE TO authenticated 
USING ( (select auth.uid()) = tenant_id );

-- Delete
CREATE POLICY "Tenants can delete own portfolio" ON portfolio 
FOR DELETE TO authenticated 
USING ( (select auth.uid()) = tenant_id );

-- Note: SELECT access is covered by "Public can view portfolio" (FOR SELECT TO public)
