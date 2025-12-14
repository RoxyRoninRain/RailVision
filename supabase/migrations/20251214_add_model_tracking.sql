-- Add model tracking columns to generations table
alter table generations 
add column if not exists model_id text,
add column if not exists input_tokens int default 0,
add column if not exists output_tokens int default 0;

-- Create index for analytics performance
create index if not exists idx_generations_model on generations(model_id);
