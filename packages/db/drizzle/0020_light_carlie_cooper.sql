CREATE TABLE "device_follow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"last_notified_action_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_follow_device_id_content_id_unique" UNIQUE("device_id","content_id")
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"content_id" uuid,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"ticket" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" varchar(20) NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Los_Angeles' NOT NULL,
	"user_id" text,
	"breaking" boolean DEFAULT true NOT NULL,
	"following" boolean DEFAULT true NOT NULL,
	"brief" boolean DEFAULT false NOT NULL,
	"recap" boolean DEFAULT false NOT NULL,
	"quiet_hours" boolean DEFAULT true NOT NULL,
	"quiet_start_min" integer DEFAULT 1320 NOT NULL,
	"quiet_end_min" integer DEFAULT 420 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_device_expo_push_token_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
ALTER TABLE "device_follow" ADD CONSTRAINT "device_follow_device_id_push_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."push_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_device_id_push_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."push_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_follow_content_id_idx" ON "device_follow" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "device_follow_device_id_idx" ON "device_follow" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" USING btree ("sent_at","not_before");--> statement-breakpoint
CREATE INDEX "notification_outbox_device_id_idx" ON "notification_outbox" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "push_device_user_id_idx" ON "push_device" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "push_device" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "device_follow" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON TABLE "push_device" FROM anon;
		REVOKE ALL ON TABLE "device_follow" FROM anon;
		REVOKE ALL ON TABLE "notification_outbox" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON TABLE "push_device" FROM authenticated;
		REVOKE ALL ON TABLE "device_follow" FROM authenticated;
		REVOKE ALL ON TABLE "notification_outbox" FROM authenticated;
	END IF;
END
$$;