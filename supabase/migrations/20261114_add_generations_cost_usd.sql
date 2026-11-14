-- ============================================================================
-- Add exact USD cost tracking column to public.generations (2026-11-14)
-- Nullable by design (metadata-only instant ADD COLUMN in Postgres, and keeps
-- historical pre-column rows NULL so computeHistoricalGenerationCost falls back
-- to model_id + input_tokens + output_tokens instead of reading 0).
-- ============================================================================

ALTER TABLE public.generations
ADD COLUMN IF NOT EXISTS cost_usd numeric(10, 6);

COMMENT ON COLUMN public.generations.cost_usd IS
    'Exact USD cost recorded at generation time (Pass 1 + Scene Router / Clean Plate / Vision QA / Pass 2). NULL for legacy rows prior to 2026-11-14.';

-- Refresh PostgREST schema cache immediately so inserts succeed on the first try
NOTIFY pgrst, 'reload schema';
