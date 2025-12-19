-- Fix for Quote Request Errors (Part 2)
-- Adds the missing 'phone' and 'style_name' columns to the leads table.
-- This ensures all form fields from the Quote Request are stored correctly.

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS style_name text;
