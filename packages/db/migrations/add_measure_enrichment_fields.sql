-- Add ballot-measure enrichment fields to the contest table.
-- These back the cross-validation engine output (see docs/MEASURE_ENRICHMENT.md):
--   summary_is_ai_generated — flags AI-only summaries so the UI can label them
--   fiscal_impact            — official fiscal analysis (LAO / county registrar)
--   citations                — per-field source attribution (JSONB array)

ALTER TABLE contest
  ADD COLUMN IF NOT EXISTS summary_is_ai_generated BOOLEAN DEFAULT FALSE;

ALTER TABLE contest
  ADD COLUMN IF NOT EXISTS fiscal_impact TEXT;

ALTER TABLE contest
  ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;
