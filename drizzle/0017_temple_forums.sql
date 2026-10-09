CREATE TABLE "temple_forums" (
	"temple_id" uuid PRIMARY KEY NOT NULL,
	"forum_origin" text NOT NULL,
	"api_username" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"api_key_hint" text DEFAULT '' NOT NULL,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temple_forums_origin_shape" CHECK (octet_length("temple_forums"."forum_origin") <= 255 and "temple_forums"."forum_origin" ~ '^https://[a-z0-9.-]+$'),
	CONSTRAINT "temple_forums_username_shape" CHECK (length("temple_forums"."api_username") between 1 and 60 and "temple_forums"."api_username" ~ '^[A-Za-z0-9._-]+$'),
	CONSTRAINT "temple_forums_key_present" CHECK (length("temple_forums"."api_key_encrypted") between 1 and 2048 and length("temple_forums"."api_key_hint") <= 8)
);
--> statement-breakpoint
ALTER TABLE "temple_forums" ADD CONSTRAINT "temple_forums_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "temple_forums" ADD CONSTRAINT "temple_forums_updated_by_id_auth_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "temple_forums_origin_idx" ON "temple_forums" USING btree ("forum_origin");