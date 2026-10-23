ALTER TABLE "device_follow" ADD COLUMN "local_decision_state" jsonb;--> statement-breakpoint
ALTER TABLE "local_decision" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "local_decision_document" ADD COLUMN "extracted_pages" jsonb;