-- Add cost_usd column to generations table if not exists
ALTER TABLE generations ADD COLUMN IF NOT EXISTS cost_usd numeric;
