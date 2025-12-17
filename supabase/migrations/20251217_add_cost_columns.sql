-- Add cost tracking columns to generations table
ALTER TABLE generations
ADD COLUMN IF NOT EXISTS model_id TEXT,
ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0;

-- Optional: index for analytics
CREATE INDEX IF NOT EXISTS idx_generations_model ON generations(model_id);
