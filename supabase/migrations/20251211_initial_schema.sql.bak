-- Enable RLS
create table if not exists portfolio (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  image_url text
);

create table if not exists leads (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  created_at timestamptz default now()
);

alter table portfolio enable row level security;
alter table leads enable row level security;

-- Policies
-- "public can READ portfolio"
create policy "Public can view portfolio"
on portfolio for select
to public
using ( true );

-- "anon can INSERT leads"
create policy "Anon can insert leads"
on leads for insert
to anon
with check ( true );

-- Init Data
insert into portfolio (name, description) values 
('Industrial', 'Raw steel, exposed bolts, mesh infill'),
('Modern Minimalist', 'Glass, clean lines, floating treads'),
('Art Deco', 'Geometric patterns, brass accents, smooth curves'),
('Rustic', 'Wrought iron, hammered finish, wood integration');
