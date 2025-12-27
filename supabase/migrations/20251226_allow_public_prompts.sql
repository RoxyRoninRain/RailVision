-- Allow public (anon + authenticated) read access to ACTIVE system prompts
-- This ensures the embedded tool (guest users) can fetch the dynamic prompt configuration
-- even if the server-side Admin Client fails to initialize (missing service key).

DROP POLICY IF EXISTS "Allow public read access to active prompts" ON system_prompts;

CREATE POLICY "Allow public read access to active prompts"
ON system_prompts
FOR SELECT
TO public
USING (is_active = true);
