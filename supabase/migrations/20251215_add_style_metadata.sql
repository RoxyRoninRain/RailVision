
-- Add metadata column for storing AI style analysis
alter table portfolio 
add column if not exists style_metadata jsonb;

-- Comment for clarity
comment on column portfolio.style_metadata is 'Stores AI-generated analysis of the style (material, geometry, vibe) for Agentic Workflow.';
