create table if not exists generations (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references profiles(id) on delete set null,
  image_url text,
  prompt_used text,
  style_id text,
  created_at timestamptz default now()
);

-- RLS
alter table generations enable row level security;

-- Admins can view all
create policy "Admins can view all generations"
  on generations for select
  using (
    auth.jwt() ->> 'email' in ('admin@railify.com', 'me@railify.com')
  );

-- Tenants can view their own
create policy "Tenants can view own generations"
  on generations for select
  using (
    auth.uid() = organization_id
  );

-- Anyone can insert (for the public tool)
-- Ideally we restrict this, but since the tool is public, we allow anon inserts
-- We just don't let them read other people's data.
create policy "Public can insert generations"
  on generations for insert
  with check (true);
