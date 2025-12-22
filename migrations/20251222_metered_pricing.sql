-- Add Metered Pricing Columns to Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_name TEXT DEFAULT 'The Estimator';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enable_overdrive BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_overage_balance NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_monthly_spend NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_usage INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
