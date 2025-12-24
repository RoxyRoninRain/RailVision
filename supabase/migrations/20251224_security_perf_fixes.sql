-- Security & Performance Fixes

-- 1. Performance: Add Index to generations.organization_id
-- We query this in RLS policies: auth.uid() = organization_id
CREATE INDEX IF NOT EXISTS generations_organization_id_idx ON generations(organization_id);

-- 2. Performance: Add Index to leads.style_id
-- Referenced Foreign Key
CREATE INDEX IF NOT EXISTS leads_style_id_idx ON leads(style_id);

-- 3. Security Check: System Prompts RLS
-- (Already Verified as enabled in 20251214_fix_rls_policies.sql, but ensuring no regression)
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
