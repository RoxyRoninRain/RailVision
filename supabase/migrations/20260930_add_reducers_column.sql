-- Add has_reducers to portfolio table
-- NULL = default / detect from style reference image
-- FALSE = direct / flush connection (strictly no reducers between square post and round top rail)
-- TRUE = reducers / transition collars required

ALTER TABLE portfolio 
ADD COLUMN IF NOT EXISTS has_reducers boolean DEFAULT NULL;
