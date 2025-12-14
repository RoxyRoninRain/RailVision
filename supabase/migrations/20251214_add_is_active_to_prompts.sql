-- Add is_active column system_prompts
ALTER TABLE system_prompts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Set the main existing prompt as active by default
UPDATE system_prompts SET is_active = true WHERE key = 'gemini-handrail-main';

-- Ensure only one prompt is active at a time (Optional constraint, but good practice)
-- CREATE UNIQUE INDEX unique_active_prompt ON system_prompts (is_active) WHERE is_active = true;
