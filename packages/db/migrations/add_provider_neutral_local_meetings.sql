-- Provider-neutral cache for local meeting systems that are not Legistar.
CREATE TABLE IF NOT EXISTS local_meeting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL,
  external_id VARCHAR(100) NOT NULL,
  name TEXT NOT NULL,
  meeting_type VARCHAR(100) NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  location TEXT,
  source_url TEXT NOT NULL,
  agenda_url TEXT,
  minutes_url TEXT,
  action_agenda_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT local_meeting_provider_jurisdiction_external_id_unique
    UNIQUE (provider, jurisdiction, external_id)
);

CREATE INDEX IF NOT EXISTS local_meeting_date_idx ON local_meeting (date);

CREATE TABLE IF NOT EXISTS local_agenda_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES local_meeting(id) ON DELETE CASCADE,
  external_id VARCHAR(100) NOT NULL,
  section TEXT,
  agenda_number VARCHAR(50),
  title TEXT NOT NULL,
  action_text TEXT,
  vote_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT local_agenda_item_meeting_id_external_id_unique
    UNIQUE (meeting_id, external_id)
);

CREATE INDEX IF NOT EXISTS local_agenda_item_meeting_idx
  ON local_agenda_item (meeting_id);
