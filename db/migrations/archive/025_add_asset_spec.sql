-- Add spec column to assets table
ALTER TABLE public.assets ADD COLUMN
IF NOT EXISTS spec jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.assets.spec IS 'Asset-specific specifications (can override model specs)';
