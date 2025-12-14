-- Allow authenticated users to insert their own profile
-- This is required for .upsert() to work if the profile doesn't exist yet
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK ( auth.uid() = id );
