-- Add gallery column to portfolio to support multiple reference images
alter table portfolio 
add column if not exists gallery text[] default array[]::text[];

-- Update RLS policies to ensure gallery is viewable
-- (Existing select policy "Public can view portfolio" using (true) covers this, 
-- but good to double check if we need granular write permissions later)
