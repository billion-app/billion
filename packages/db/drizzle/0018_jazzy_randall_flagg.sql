CREATE TABLE "featured_bill" (
	"bill_id" uuid PRIMARY KEY NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"rationale" text,
	"curated_by" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "featured_bill" ADD CONSTRAINT "featured_bill_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "featured_bill_active_order_idx" ON "featured_bill" USING btree ("active","display_order");--> statement-breakpoint
ALTER TABLE "featured_bill" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "featured_bill" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "featured_bill" FROM authenticated;
	END IF;
END
$$;
