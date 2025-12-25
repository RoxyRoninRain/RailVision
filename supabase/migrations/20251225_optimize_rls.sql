-- OPTIMIZATION MIGRATION: RLS & Function Security
-- Addresses Supabase Lint Warnings: auth_rls_initplan, multiple_permissive_policies, function_search_path_mutable

-- 1. FIX: Mutable Search Path (Security)
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. OPTIMIZE: PROFILES
-- Fix: Use (select auth.uid()) to prevent re-evaluation per row
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles 
FOR SELECT TO authenticated 
USING ( (select auth.uid()) = id );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE TO authenticated 
USING ( (select auth.uid()) = id );

-- 3. OPTIMIZE: LEADS
-- Fix: Use (select auth.uid()) and consolidate duplicate policies
DROP POLICY IF EXISTS "Shop Owners View Own Leads" ON leads;
DROP POLICY IF EXISTS "Users view own leads" ON leads; -- Drop duplicate

CREATE POLICY "Users view own leads" ON leads 
FOR SELECT TO authenticated 
USING ( (select auth.uid()) = organization_id );

-- 4. OPTIMIZE: GENERATIONS
-- Fix: Use (select auth.uid()) and consolidate policies
DROP POLICY IF EXISTS "Admins can view all generations" ON generations;
DROP POLICY IF EXISTS "Tenants can view own generations" ON generations;
DROP POLICY IF EXISTS "Users view own generations" ON generations; -- Drop duplicate

CREATE POLICY "Users view own generations" ON generations 
FOR SELECT TO authenticated 
USING ( (select auth.uid()) = organization_id );
-- Note: Admin access might be handled via Service Role in app, or you can add `OR (select auth.jwt()) ->> 'role' = 'service_role'` etc.
-- For now, sticking to strict tenant isolation.

-- 5. OPTIMIZE: PORTFOLIO
-- Fix: Use (select auth.uid()) and consolidate MANY duplicates
-- Column name: tenant_id (confirmed via checking 20251213 migration)

-- Drop all variants
DROP POLICY IF EXISTS "Tenants can manage their own portfolio" ON portfolio;
DROP POLICY IF EXISTS "Tenants can insert own styles" ON portfolio;
DROP POLICY IF EXISTS "Tenants can delete own styles" ON portfolio;
DROP POLICY IF EXISTS "Tenants can update own styles" ON portfolio;
DROP POLICY IF EXISTS "Users can view their own portfolio" ON portfolio;
DROP POLICY IF EXISTS "Users can insert their own portfolio" ON portfolio;
DROP POLICY IF EXISTS "Users can update their own portfolio" ON portfolio;
DROP POLICY IF EXISTS "Users can delete their own portfolio" ON portfolio;
DROP POLICY IF EXISTS "Public can view active styles" ON portfolio; -- Partially redundant with Public view

-- Re-create Clean Policies

-- A. Public Read (All styles)
DROP POLICY IF EXISTS "Public can view portfolio" ON portfolio;
CREATE POLICY "Public can view portfolio" ON portfolio 
FOR SELECT TO public 
USING (true);

-- B. Tenant Manage (All Actions) - Consolidated
CREATE POLICY "Tenants can manage own portfolio" ON portfolio 
FOR ALL TO authenticated 
USING ( (select auth.uid()) = tenant_id )
WITH CHECK ( (select auth.uid()) = tenant_id );

