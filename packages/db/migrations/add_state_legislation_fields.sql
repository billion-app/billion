ALTER TABLE "bill"
  ADD COLUMN IF NOT EXISTS "jurisdiction" varchar(100) DEFAULT 'ocd-jurisdiction/country:us/government' NOT NULL,
  ADD COLUMN IF NOT EXISTS "legislative_session" varchar(20) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "open_states_id" text,
  ADD COLUMN IF NOT EXISTS "subjects" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "sponsorships" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "documents" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "votes" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE "bill" DROP CONSTRAINT IF EXISTS "bill_bill_number_source_website_unique";
ALTER TABLE "bill" DROP CONSTRAINT IF EXISTS "bill_bill_number_source_website_legislative_session_unique";
ALTER TABLE "bill"
  ADD CONSTRAINT "bill_bill_number_source_website_legislative_session_unique"
  UNIQUE("bill_number", "source_website", "legislative_session");
