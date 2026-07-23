-- Enable pg_trgm for trigram similarity search (used for fuzzy bill/case code
-- matching, e.g. "hr1234" matching "H.R. 1234"). Extensions aren't managed by
-- drizzle-kit schema generation, so this was run manually on databases that
-- predate migration tracking. New databases enable it in the migration history.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
