-- Add 'attachments' to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS attachments text[];

-- Add 'confirmation_email_body' to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS confirmation_email_body text DEFAULT 'Thank you for your request. We will review your project and get back to you shortly.';
