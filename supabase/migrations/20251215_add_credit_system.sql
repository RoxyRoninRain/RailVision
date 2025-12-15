-- Add credit system columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'salesmate',
ADD COLUMN IF NOT EXISTS credits_monthly INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS credits_rollover INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_booster INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_boost_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_boost_pack TEXT;

-- Add checking constraints to ensure non-negative credits
ALTER TABLE profiles 
ADD CONSTRAINT check_credits_monthly_non_negative CHECK (credits_monthly >= 0),
ADD CONSTRAINT check_credits_rollover_non_negative CHECK (credits_rollover >= 0),
ADD CONSTRAINT check_credits_booster_non_negative CHECK (credits_booster >= 0);
