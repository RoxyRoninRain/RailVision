-- Add watermark_logo_url column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS watermark_logo_url TEXT;
