-- Fix for Quote Request Errors
-- Adds the missing 'message' column to the leads table so detailed requests can be stored.

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS message text;
