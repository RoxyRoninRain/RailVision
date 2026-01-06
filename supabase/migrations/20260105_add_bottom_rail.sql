-- Add has_bottom_rail to portfolio table
-- Defaults to NULL to indicate "use legacy guessing behavior" or "undefined"

ALTER TABLE portfolio 
ADD COLUMN IF NOT EXISTS has_bottom_rail boolean DEFAULT NULL;
