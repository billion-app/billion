-- Provider-neutral handoff for current-cycle official election sources.
-- Texas SOS facts and TLC explanatory text are stored in separate provider
-- rows so their citations cannot be accidentally collapsed.
CREATE TABLE IF NOT EXISTS election_source_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  jurisdiction varchar(20) NOT NULL,
  cycle_year integer NOT NULL,
  provider varchar(50) NOT NULL,
  scope varchar(50) DEFAULT 'current' NOT NULL,
  source_version varchar(150) NOT NULL,
  content_hash varchar(64) NOT NULL,
  data jsonb NOT NULL,
  diagnostics jsonb DEFAULT '[]'::jsonb NOT NULL,
  source_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
  fetched_at timestamp with time zone NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  CONSTRAINT election_source_snapshot_unique
    UNIQUE (jurisdiction, cycle_year, provider, scope)
);

CREATE INDEX IF NOT EXISTS election_snapshot_current_cycle_idx
  ON election_source_snapshot (jurisdiction, scope, cycle_year);
