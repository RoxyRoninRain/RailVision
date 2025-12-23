-- FIX: Ensure all billing columns exist in profiles table
-- Run this in your Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_overage_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_overage_balance decimal DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_monthly_spend decimal DEFAULT 100,
ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz,
ADD COLUMN IF NOT EXISTS onboarding_fee_paid boolean DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN profiles.current_overage_count IS 'Tracks unbilled overage units for threshold billing triggers';
