-- Force ensure website column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'website') THEN
        ALTER TABLE profiles ADD COLUMN website text;
    END IF;
END $$;

-- Verify RLS for Update
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING ( auth.uid() = id );

-- Verify RLS for Insert (as we use upsert)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK ( auth.uid() = id );

-- Ensure Select is open (or at least owned)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING ( auth.uid() = id );

-- Allow Service Role to do anything (Admin Client)
-- (Implicit, but good to check if we had explicit deny policies)
