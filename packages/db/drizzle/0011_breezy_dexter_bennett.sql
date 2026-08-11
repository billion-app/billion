ALTER TABLE "bill" ADD COLUMN "last_action_at" timestamp;--> statement-breakpoint
-- Backfill from the actions already stored on each row. `actions` is a jsonb
-- array of {date, text, ...}; the newest valid date is the bill's last action.
--
-- Guarded on a date-shaped string because the column is unvalidated jsonb: a
-- malformed entry would abort the whole migration on a cast error, and one bad
-- row must not block the column. Bills with no parseable action stay null and
-- fall back to `introduced_date` at read time.
UPDATE "bill" SET "last_action_at" = sub.latest
FROM (
  SELECT b.id,
         MAX((a->>'date')::timestamp) AS latest
  FROM "bill" b
  CROSS JOIN LATERAL jsonb_array_elements(b.actions) a
  WHERE a->>'date' ~ '^\d{4}-\d{2}-\d{2}'
  GROUP BY b.id
) sub
WHERE "bill".id = sub.id;
