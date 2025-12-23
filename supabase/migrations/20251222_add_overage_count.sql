-- Add current_overage_count for threshold billing tracking

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS current_overage_count integer DEFAULT 0;

COMMENT ON COLUMN profiles.current_overage_count IS 'Tracks unbilled overage units for threshold billing triggers';
