-- Create blocked_ips table
create table if not exists public.blocked_ips (
    id uuid default gen_random_uuid() primary key,
    ip_address text not null unique,
    reason text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_by uuid references auth.users(id)
);

-- RLS Policies
alter table public.blocked_ips enable row level security;

-- Only admins can view/add/delete blocked IPs
create policy "Admins can do everything on blocked_ips"
    on public.blocked_ips
    for all
    using (
        auth.jwt() ->> 'email' in ('admin@railify.com', 'me@railify.com')
    );

-- Public/Anon needs to be able to read (via service role in actions usually, but strictly speaking checking existence might be needed)
-- Actually, the server action 'generateDesign' will use Service Role to check this table to prevent tampering, 
-- or we can allow public read if we want to confirm blockage client-side (unlikely).
-- Let's stick to Admin Only RLS and use Admin Client for checks in Server Actions.
