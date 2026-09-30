-- Add Free Credits and Discounted Credits tracking to Profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS free_credits_remaining INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discounted_credits_remaining INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discounted_rate NUMERIC DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_discounted_amount NUMERIC DEFAULT 0.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_discounted_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_received_signup_bonus BOOLEAN DEFAULT FALSE;
