CREATE TABLE "notification_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(30) DEFAULT 'breaking' NOT NULL,
	"title" varchar(100) NOT NULL,
	"body" varchar(240) NOT NULL,
	"content_id" uuid,
	"route" text NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notification_alert_idempotencyKey_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"expo_ticket_id" text,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_delivery_alertId_deviceId_unique" UNIQUE("alert_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "push_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"expo_push_token" text NOT NULL,
	"platform" varchar(20) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"breaking_news" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_device_expoPushToken_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_alert_id_notification_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."notification_alert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_device_id_push_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."push_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_delivery_receipt_idx" ON "notification_delivery" USING btree ("status","expo_ticket_id");--> statement-breakpoint
CREATE INDEX "push_device_user_id_idx" ON "push_device" USING btree ("user_id");