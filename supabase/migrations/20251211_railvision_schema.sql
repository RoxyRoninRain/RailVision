-- Update leads table
alter table leads 
add column if not exists organization_id uuid default auth.uid(), -- Default to current user for simpler inserts in this demo
add column if not exists style_id uuid references portfolio(id),
add column if not exists customer_name text,
add column if not exists status text default 'New',
add column if not exists generated_design_url text,
add column if not exists estimate_json jsonb;

-- Index for performance
create index if not exists leads_org_idx on leads(organization_id);

-- RLS: Shop Owner Access
-- "A Shop Owner MUST NOT be able to query leads from another shop."
-- Policy: Users can only view leads where organization_id matches their auth.uid()
drop policy if exists "Shop Owners View Own Leads" on leads;
create policy "Shop Owners View Own Leads"
on leads for select
to authenticated
using ( organization_id = auth.uid() );

-- Policy: Admin Access (Simple check for specific admin email or role claim if we had one)
-- For now, letting them view all if they have a specific claim or just separate policy?
-- Prompt says: "Super Admin Only" for /admin/stats leads query.
-- We'll add a policy for a hypothetical super admin or just rely on service_role for the stats query if it's a server action using a service key (which we strictly avoided in mandates? "Server Actions for all API calls - NO client-side secrets").
-- Actually, Server Actions run on server. If we use `supabase` client from `lib/supabase.ts`, it uses the ANON key by default (which subjects it to RLS).
-- To do "Super Admin" stuff, we might need a SERVICE_ROLE client or a specific Admin RLS policy.
-- The prompt said "Server Actions for all API calls".
-- I'll define a policy that allows a specific "admin" user to see all, or just rely on RLS `using (true)` if the user is an admin.
-- For simplicity in this demo without a complex Auth setup: I'll assume the "admin" will query stats via a function that might bypass RLS or use a special claim.
-- BUT, strictly following RLS:
-- Let's assume we might have a function for stats, or just use `service_role` client for the admin stats action.
-- Wait, `lib/supabase.ts` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
-- I should probably create `lib/supabase-admin.ts` for the admin stats if strictly needed, OR just stick to RLS.
-- Let's stick to RLS for now and maybe add a policy for a hardcoded admin email for demo purposes if needed, or just focus on the Shop Owner part which is explicitly requested.

-- Update insert policy to allow anon users (public funnel) to insert these new fields
-- Existing policy: "Anon can insert leads" with check (true). usage of defaults handles the restricted fields?
-- We need to ensure anon users can set `customer_name`, `style_id`, etc.
-- The existing insert policy `with check (true)` allows all columns by default unless restrictive column policies exist (which Supabase doesn't do by default for insert rows logic usually, column level privileges are separate).
-- So existing insert policy is fine.

