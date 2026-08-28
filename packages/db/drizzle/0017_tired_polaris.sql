ALTER TABLE "government_content" ADD COLUMN "federal_register_url" text;--> statement-breakpoint
ALTER TABLE "government_content" ADD COLUMN "federal_register_document_number" varchar(50);--> statement-breakpoint
ALTER TABLE "government_content" ADD COLUMN "federal_register_published_date" timestamp;--> statement-breakpoint
ALTER TABLE "government_content" ADD CONSTRAINT "government_content_federalRegisterUrl_unique" UNIQUE("federal_register_url");--> statement-breakpoint
ALTER TABLE "government_content" ADD CONSTRAINT "government_content_federalRegisterDocumentNumber_unique" UNIQUE("federal_register_document_number");