-- Add columns for implementation of Metered Pricing and Onboarding flows

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz,
ADD COLUMN IF NOT EXISTS onboarding_fee_paid boolean DEFAULT false;

-- Enhance comments for clarity
COMMENT ON COLUMN profiles.onboarding_status IS 'Tracks progress: pending, paid, completed, active';
COMMENT ON COLUMN profiles.subscription_start_date IS 'When the deferred subscription billing period actually begins';
COMMENT ON COLUMN profiles.onboarding_fee_paid IS 'Whether the one-time onboarding fee has been collected';
