
-- Add notification_state column to profiles to track email triggers
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_state JSONB DEFAULT '{}'::jsonb;
