-- Add enable_overdrive column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS enable_overdrive boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS max_monthly_spend numeric DEFAULT 100;

COMMENT ON COLUMN profiles.enable_overdrive IS 'Allows the shop to spend beyond their subscription allowance.';

