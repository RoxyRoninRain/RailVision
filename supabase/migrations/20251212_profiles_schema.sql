-- Create Profiles Table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  shop_name text,
  subscription_status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Policies
create policy "Users can view own profile" 
  on profiles for select 
  using ( auth.uid() = id );

create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

-- Trigger to create profile on signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Linking Leads to Profiles (Optional but good for explicit relations)
-- We already have organization_id in leads which is auth.uid(), so it implicitly links to profiles.id
