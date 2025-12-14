-- Add tool_background_color to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tool_background_color text DEFAULT '#050505';
