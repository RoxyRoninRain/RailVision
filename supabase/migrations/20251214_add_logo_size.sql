-- Add logo_size column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS logo_size INTEGER DEFAULT 80;

-- Comment for clarity
COMMENT ON COLUMN profiles.logo_size IS 'Height in pixels for the tenant logo in the visualizer header';
