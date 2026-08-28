CREATE TABLE "bill_interest" (
	"bill_id" uuid PRIMARY KEY NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"interest_score" integer NOT NULL,
	"controversy_score" integer NOT NULL,
	"attention_score" integer NOT NULL,
	"reason" text NOT NULL,
	"model_version" varchar(100) NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_interest_interest_score_range" CHECK ("bill_interest"."interest_score" between 0 and 100),
	CONSTRAINT "bill_interest_controversy_score_range" CHECK ("bill_interest"."controversy_score" between 0 and 100),
	CONSTRAINT "bill_interest_attention_score_range" CHECK ("bill_interest"."attention_score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "bill_interest" ADD CONSTRAINT "bill_interest_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_interest_interest_score_idx" ON "bill_interest" USING btree ("interest_score");--> statement-breakpoint
CREATE INDEX "bill_interest_controversy_score_idx" ON "bill_interest" USING btree ("controversy_score");--> statement-breakpoint
CREATE INDEX "bill_interest_attention_score_idx" ON "bill_interest" USING btree ("attention_score");--> statement-breakpoint
ALTER TABLE "bill_interest" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "bill_interest" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "bill_interest" FROM authenticated;
	END IF;
END
$$;
