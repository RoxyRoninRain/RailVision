-- Rename gallery to reference_images to better reflect its purpose (AI Hidden Context)
ALTER TABLE portfolio
RENAME COLUMN gallery TO reference_images;

-- Ensure it is an array of text
-- (It was created as text[] default array[]::text[] in previous migration, so type should be correct)
