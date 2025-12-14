-- FIX: Ensure RLS Policies allow access to System Prompts
-- This ensures that if the Admin Client fails and we fallback to the Standard Client,
-- the Standard Client (authenticated user) still has permission to read/write prompts.

-- 1. Enable RLS (Safe to run if already enabled)
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON system_prompts;
DROP POLICY IF EXISTS "Enable read access for all users" ON system_prompts;

-- 3. Create a policy that allows Authenticated Users (Admins) to do everything
CREATE POLICY "Allow full access to authenticated users"
ON system_prompts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Verify the prompt exists and is active
SELECT key, is_active FROM system_prompts WHERE key = 'gemini-handrail-main';
