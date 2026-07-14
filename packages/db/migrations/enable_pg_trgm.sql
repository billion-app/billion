-- Enable pg_trgm for trigram similarity search (used for fuzzy bill/case code
-- matching, e.g. "hr1234" matching "H.R. 1234"). Extensions aren't managed by
-- drizzle-kit push, so this must be run manually against the DB once, before
-- the search_vector / trigram index columns in schema.ts are pushed.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
