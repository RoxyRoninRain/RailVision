-- Add display_order column to portfolio table
ALTER TABLE portfolio 
ADD COLUMN display_order INTEGER DEFAULT 0;

-- Update existing records to have a default order based on creation time (optional but good for consistency)
-- This ensures that initial state is deterministic based on what was likely the implicit order
WITH ordered_portfolio AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM portfolio
)
UPDATE portfolio
SET display_order = ordered_portfolio.rn
FROM ordered_portfolio
WHERE portfolio.id = ordered_portfolio.id;
