-- Add primary_color column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#FFD700';

-- Comment on column
COMMENT ON COLUMN profiles.primary_color IS 'Hex code for tenant branding color (default: #FFD700)';
