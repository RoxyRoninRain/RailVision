-- FIX: Grant full access (Delete/Update) to own leads
-- Previously only SELECT was optimized, missing other permissions.

-- Drop existing restricted policies
DROP POLICY IF EXISTS "Users view own leads" ON leads;
DROP POLICY IF EXISTS "Shop Owners View Own Leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

-- Create comprehensive policy
CREATE POLICY "Users can manage own leads" ON leads
FOR ALL TO authenticated
USING ( (select auth.uid()) = organization_id )
WITH CHECK ( (select auth.uid()) = organization_id );
