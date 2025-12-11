-- 1. Create Tables (Initial Schema)
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

-- 2. Add RailVision Columns (Idempotent updates)
alter table leads 
add column if not exists organization_id uuid default auth.uid(),
add column if not exists style_id uuid references portfolio(id),
add column if not exists customer_name text,
add column if not exists status text default 'New',
add column if not exists generated_design_url text,
add column if not exists estimate_json jsonb;

-- 3. Indexes
create index if not exists leads_org_idx on leads(organization_id);

-- 4. Enable RLS
alter table portfolio enable row level security;
alter table leads enable row level security;

-- 5. Policies
-- Portfolio: Public key view
drop policy if exists "Public can view portfolio" on portfolio;
create policy "Public can view portfolio" on portfolio for select to public using ( true );

-- Leads: Public Insert (Funnel)
drop policy if exists "Anon can insert leads" on leads;
create policy "Anon can insert leads" on leads for insert to anon with check ( true );

-- Leads: Shop Owner View (Strict RLS)
drop policy if exists "Shop Owners View Own Leads" on leads;
create policy "Shop Owners View Own Leads" on leads for select to authenticated using ( organization_id = auth.uid() );

-- 6. Initial Data (Idempotent insert)
insert into portfolio (name, description) 
select 'Industrial', 'Raw steel, exposed bolts, mesh infill'
where not exists (select 1 from portfolio where name = 'Industrial');

insert into portfolio (name, description) 
select 'Modern Minimalist', 'Glass, clean lines, floating treads'
where not exists (select 1 from portfolio where name = 'Modern Minimalist');

insert into portfolio (name, description) 
select 'Art Deco', 'Geometric patterns, brass accents, smooth curves'
where not exists (select 1 from portfolio where name = 'Art Deco');

insert into portfolio (name, description) 
select 'Rustic', 'Wrought iron, hammered finish, wood integration'
where not exists (select 1 from portfolio where name = 'Rustic');
