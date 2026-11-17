CREATE TABLE "enochian_reading_spend" (
	"day" date PRIMARY KEY NOT NULL,
	"micro_usd" bigint NOT NULL,
	CONSTRAINT "enochian_reading_spend_not_negative" CHECK ("enochian_reading_spend"."micro_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enochian_reading_switch" (
	"id" text PRIMARY KEY NOT NULL,
	"off" boolean NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enochian_reading_switch_one_row" CHECK ("enochian_reading_switch"."id" = 'readings')
);
--> statement-breakpoint
CREATE TABLE "enochian_readings" (
	"version" text NOT NULL,
	"passage" text NOT NULL,
	"parts" jsonb NOT NULL,
	"complete" boolean NOT NULL,
	"claim" text,
	"pending_until" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "enochian_readings_version_passage_pk" PRIMARY KEY("version","passage")
);
--> statement-breakpoint
CREATE INDEX "enochian_readings_created_at" ON "enochian_readings" USING btree ("created_at");