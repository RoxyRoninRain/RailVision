-- Add post_mount to portfolio table
-- 'top' = surface mount to top of stair treads/landing floor using base plates (default)
-- 'side' = fascia mount to outer stair stringer face using side-mount brackets

ALTER TABLE portfolio 
ADD COLUMN IF NOT EXISTS post_mount text DEFAULT 'top';
