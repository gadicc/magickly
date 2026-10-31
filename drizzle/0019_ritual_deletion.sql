CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"actor_id" uuid,
	"subject_kind" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"action" text NOT NULL,
	"scope" text NOT NULL,
	"temple_id" uuid,
	"group_id" uuid,
	CONSTRAINT "audit_events_id_v7" CHECK (substring("audit_events"."id"::text from 15 for 1) = '7' and substring("audit_events"."id"::text from 20 for 1) in ('8', '9', 'a', 'b')),
	CONSTRAINT "audit_events_subject_kind" CHECK ("audit_events"."subject_kind" in ('ritual')),
	CONSTRAINT "audit_events_action" CHECK ("audit_events"."action" in ('delete', 'restore', 'purge_requested', 'purge_cancelled', 'purged')),
	CONSTRAINT "audit_events_actor" CHECK ("audit_events"."actor_id" is not null or "audit_events"."action" = 'purged'),
	CONSTRAINT "audit_events_scope" CHECK (("audit_events"."scope" = 'public' and "audit_events"."temple_id" is null and "audit_events"."group_id" is null)
    or ("audit_events"."scope" = 'group' and "audit_events"."group_id" is not null and "audit_events"."temple_id" is null)
    or ("audit_events"."scope" = 'temple' and "audit_events"."temple_id" is not null and "audit_events"."group_id" is null))
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"job" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text,
	"due" integer,
	"purged" integer,
	"deferred" integer,
	"failed" integer,
	CONSTRAINT "cron_runs_job" CHECK ("cron_runs"."job" in ('purge-deleted-rituals')),
	CONSTRAINT "cron_runs_outcome" CHECK ("cron_runs"."outcome" is null or "cron_runs"."outcome" in ('ok', 'partial', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "rituals" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rituals" ADD COLUMN "deleted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "rituals" ADD COLUMN "purge_after" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rituals" ADD COLUMN "purge_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rituals" ADD COLUMN "purge_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rituals" ADD COLUMN "purge_objects_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_auth_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_subject_idx" ON "audit_events" USING btree ("subject_kind","subject_id","at");--> statement-breakpoint
CREATE INDEX "audit_events_temple_idx" ON "audit_events" USING btree ("temple_id","at");--> statement-breakpoint
ALTER TABLE "rituals" ADD CONSTRAINT "rituals_deleted_by_id_auth_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rituals_purge_due_idx" ON "rituals" USING btree ("purge_after") WHERE "rituals"."purge_after" is not null;--> statement-breakpoint
ALTER TABLE "rituals" ADD CONSTRAINT "rituals_deletion_state" CHECK (
    ("rituals"."deleted_at" is null and "rituals"."deleted_by_id" is null and "rituals"."purge_after" is null
      and "rituals"."purge_requested_at" is null and "rituals"."purge_started_at" is null
      and "rituals"."purge_objects_deleted_at" is null)
    or ("rituals"."deleted_at" is not null and "rituals"."deleted_by_id" is not null
      and "rituals"."purge_after" is not null and "rituals"."purge_after" >= "rituals"."deleted_at"
      and ("rituals"."purge_requested_at" is null or "rituals"."purge_requested_at" >= "rituals"."deleted_at")
      and ("rituals"."purge_started_at" is null or "rituals"."purge_started_at" >= "rituals"."deleted_at")
      and ("rituals"."purge_objects_deleted_at" is null
        or ("rituals"."purge_started_at" is not null and "rituals"."purge_objects_deleted_at" >= "rituals"."purge_started_at"))));