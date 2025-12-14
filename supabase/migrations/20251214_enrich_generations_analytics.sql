-- Add analytics columns to generations table
alter table generations 
add column if not exists ip_address text,
add column if not exists user_agent text,
add column if not exists is_blocked boolean default false,
add column if not exists blocked_reason text;

-- Create index for faster IP lookups
create index if not exists idx_generations_ip on generations(ip_address);
create index if not exists idx_generations_style on generations(style_id);

-- RLS Update (Admins can see IP, Tenants cannot)
-- Existing policies already handle row visibility, but we adding these columns is fine.
-- Public insert is already allowed.
