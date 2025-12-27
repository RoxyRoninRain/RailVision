
-- Create blocked_ips table
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, ip_address)
);

-- Add ip_address to generations if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'generations' AND column_name = 'ip_address') THEN
        ALTER TABLE generations ADD COLUMN ip_address TEXT;
    END IF;
END $$;

-- Add ip_address to leads if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'ip_address') THEN
        ALTER TABLE leads ADD COLUMN ip_address TEXT;
    END IF;
END $$;

-- Enable RLS on blocked_ips
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Policies for blocked_ips
DROP POLICY IF EXISTS "Tenants can view their blocked IPs" ON blocked_ips;
CREATE POLICY "Tenants can view their blocked IPs" ON blocked_ips
    FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can insert blocked IPs" ON blocked_ips;
CREATE POLICY "Tenants can insert blocked IPs" ON blocked_ips
    FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants can delete their blocked IPs" ON blocked_ips;
CREATE POLICY "Tenants can delete their blocked IPs" ON blocked_ips
    FOR DELETE USING (auth.uid() = tenant_id);

-- Add index for performance on lookups
CREATE INDEX IF NOT EXISTS idx_blocked_ips_tenant_ip ON blocked_ips(tenant_id, ip_address);
