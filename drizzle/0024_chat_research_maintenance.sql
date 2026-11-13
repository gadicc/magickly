CREATE TABLE "chat_research_maintenance" (
	"profile_sha256" text PRIMARY KEY NOT NULL,
	"target_sha256" text NOT NULL,
	"artifact_schema" text NOT NULL,
	"controller_pid" integer,
	"artifact_table_oid" bigint NOT NULL,
	"publication_cutoff" timestamp with time zone NOT NULL,
	"coverage_through" timestamp with time zone NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'idle' NOT NULL,
	"run_id" uuid,
	"started_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"observed_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"expired_permits" integer,
	"expired_packets" integer,
	"unpurged_packets" integer,
	"latest_retain_until" timestamp with time zone,
	"purged_permits" integer,
	"purged_packets" integer,
	CONSTRAINT "chat_research_maintenance_identity" CHECK ("chat_research_maintenance"."profile_sha256" ~ '^[a-f0-9]{64}$' and length("chat_research_maintenance"."profile_sha256")=64 and "chat_research_maintenance"."target_sha256" ~ '^[a-f0-9]{64}$' and length("chat_research_maintenance"."target_sha256")=64 and ("chat_research_maintenance"."run_id" is null or (substring("chat_research_maintenance"."run_id"::text from 15 for 1)='7' and substring("chat_research_maintenance"."run_id"::text from 20 for 1) in ('8','9','a','b')))),
	CONSTRAINT "chat_research_maintenance_namespace" CHECK (pg_catalog.length("chat_research_maintenance"."artifact_schema") between 1 and 63 and "chat_research_maintenance"."artifact_schema"=pg_catalog.btrim("chat_research_maintenance"."artifact_schema") and "chat_research_maintenance"."artifact_schema" ~ '^[a-z_][a-z0-9_]*$' and "chat_research_maintenance"."artifact_schema" !~ '[^a-z0-9_]' and pg_catalog.left("chat_research_maintenance"."artifact_schema",3)<>'pg_' and "chat_research_maintenance"."artifact_schema"<>'information_schema'),
	CONSTRAINT "chat_research_maintenance_pid" CHECK (("chat_research_maintenance"."state"='idle' and "chat_research_maintenance"."controller_pid" is null) or ("chat_research_maintenance"."state"<>'idle' and "chat_research_maintenance"."controller_pid" is not null and "chat_research_maintenance"."controller_pid">0)),
	CONSTRAINT "chat_research_maintenance_oid" CHECK ("chat_research_maintenance"."artifact_table_oid" between 1 and 4294967295),
	CONSTRAINT "chat_research_maintenance_revision" CHECK ("chat_research_maintenance"."revision" between 1 and 9007199254740991),
	CONSTRAINT "chat_research_maintenance_coverage" CHECK (pg_catalog.isfinite("chat_research_maintenance"."publication_cutoff") and "chat_research_maintenance"."publication_cutoff">=timestamptz '1970-01-01T00:00:00Z' and pg_catalog.isfinite("chat_research_maintenance"."coverage_through") and "chat_research_maintenance"."coverage_through"="chat_research_maintenance"."publication_cutoff"+interval '721 hours'),
	CONSTRAINT "chat_research_maintenance_times" CHECK (("chat_research_maintenance"."started_at" is null or pg_catalog.isfinite("chat_research_maintenance"."started_at")) and ("chat_research_maintenance"."lease_expires_at" is null or pg_catalog.isfinite("chat_research_maintenance"."lease_expires_at")) and ("chat_research_maintenance"."observed_at" is null or pg_catalog.isfinite("chat_research_maintenance"."observed_at")) and ("chat_research_maintenance"."finished_at" is null or pg_catalog.isfinite("chat_research_maintenance"."finished_at")) and ("chat_research_maintenance"."latest_retain_until" is null or pg_catalog.isfinite("chat_research_maintenance"."latest_retain_until"))),
	CONSTRAINT "chat_research_maintenance_state" CHECK (
    ("chat_research_maintenance"."state"='idle' and "chat_research_maintenance"."run_id" is null and "chat_research_maintenance"."started_at" is null and "chat_research_maintenance"."lease_expires_at" is null and "chat_research_maintenance"."finished_at" is null and "chat_research_maintenance"."observed_at" is null)
    or ("chat_research_maintenance"."state"='started' and "chat_research_maintenance"."run_id" is not null and "chat_research_maintenance"."started_at" is not null and "chat_research_maintenance"."lease_expires_at" is not null and "chat_research_maintenance"."lease_expires_at"="chat_research_maintenance"."started_at"+interval '60 seconds' and "chat_research_maintenance"."finished_at" is null and "chat_research_maintenance"."observed_at" is null)
    or ("chat_research_maintenance"."state"='failed' and "chat_research_maintenance"."run_id" is not null and "chat_research_maintenance"."started_at" is not null and "chat_research_maintenance"."lease_expires_at" is not null and "chat_research_maintenance"."finished_at" is not null and "chat_research_maintenance"."lease_expires_at"="chat_research_maintenance"."started_at"+interval '60 seconds' and "chat_research_maintenance"."finished_at">="chat_research_maintenance"."started_at" and "chat_research_maintenance"."finished_at"<"chat_research_maintenance"."lease_expires_at" and "chat_research_maintenance"."observed_at" is null)
    or ("chat_research_maintenance"."state" in ('healthy','pending','closed') and "chat_research_maintenance"."run_id" is not null and "chat_research_maintenance"."started_at" is not null and "chat_research_maintenance"."lease_expires_at" is not null and "chat_research_maintenance"."observed_at" is not null and "chat_research_maintenance"."finished_at" is not null and "chat_research_maintenance"."lease_expires_at"="chat_research_maintenance"."started_at"+interval '60 seconds' and "chat_research_maintenance"."observed_at">="chat_research_maintenance"."started_at" and "chat_research_maintenance"."finished_at">="chat_research_maintenance"."observed_at" and "chat_research_maintenance"."finished_at"<"chat_research_maintenance"."lease_expires_at")),
	CONSTRAINT "chat_research_maintenance_counts" CHECK (
    ("chat_research_maintenance"."state" in ('idle','started','failed') and "chat_research_maintenance"."expired_permits" is null and "chat_research_maintenance"."expired_packets" is null and "chat_research_maintenance"."unpurged_packets" is null and "chat_research_maintenance"."latest_retain_until" is null and "chat_research_maintenance"."purged_permits" is null and "chat_research_maintenance"."purged_packets" is null)
    or ("chat_research_maintenance"."state" in ('healthy','pending','closed') and "chat_research_maintenance"."expired_permits" is not null and "chat_research_maintenance"."expired_packets" is not null and "chat_research_maintenance"."unpurged_packets" is not null and "chat_research_maintenance"."purged_permits" is not null and "chat_research_maintenance"."purged_packets" is not null and "chat_research_maintenance"."expired_permits">=0 and "chat_research_maintenance"."expired_packets">="chat_research_maintenance"."expired_permits" and "chat_research_maintenance"."expired_packets"<=2*"chat_research_maintenance"."expired_permits" and "chat_research_maintenance"."unpurged_packets">="chat_research_maintenance"."expired_packets" and (("chat_research_maintenance"."unpurged_packets"=0 and "chat_research_maintenance"."latest_retain_until" is null) or ("chat_research_maintenance"."unpurged_packets">0 and "chat_research_maintenance"."latest_retain_until" is not null)) and "chat_research_maintenance"."purged_permits" between 0 and 100 and "chat_research_maintenance"."purged_packets" between 0 and 200)),
	CONSTRAINT "chat_research_maintenance_terminal" CHECK (("chat_research_maintenance"."state"<>'healthy' or ("chat_research_maintenance"."expired_packets"=0 and ("chat_research_maintenance"."latest_retain_until" is null or "chat_research_maintenance"."latest_retain_until"<="chat_research_maintenance"."coverage_through"-interval '1 hour'))) and ("chat_research_maintenance"."state"<>'closed' or "chat_research_maintenance"."unpurged_packets"=0))
);

--> statement-breakpoint
-- App-owned: immutable profile target, nonresetting revision and physical-session ownership.
CREATE FUNCTION public.chat_research_maintenance_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $maintenance$
DECLARE actual_oid oid; lock_key bigint; now_at timestamptz;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'idle' OR NEW.revision<>1 THEN RAISE EXCEPTION 'Invalid maintenance seed'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP IN ('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Maintenance records cannot be deleted'; END IF;
  IF OLD.state='closed' OR ROW(NEW.profile_sha256,NEW.target_sha256,NEW.artifact_schema,NEW.artifact_table_oid,NEW.publication_cutoff,NEW.coverage_through)
    IS DISTINCT FROM ROW(OLD.profile_sha256,OLD.target_sha256,OLD.artifact_schema,OLD.artifact_table_oid,OLD.publication_cutoff,OLD.coverage_through)
    OR NEW.state='idle' THEN RAISE EXCEPTION 'Immutable maintenance profile'; END IF;
  SELECT c.oid INTO actual_oid FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=NEW.artifact_schema AND c.relname='chat_research_artifacts' AND c.relkind='r' AND c.relpersistence='p';
  IF actual_oid IS DISTINCT FROM NEW.artifact_table_oid::oid THEN RAISE EXCEPTION 'Maintenance target changed'; END IF;
  lock_key:=pg_catalog.hashtextextended('magickli-retention-controller-v1:'||actual_oid::text,0);
  IF NEW.controller_pid IS DISTINCT FROM pg_catalog.pg_backend_pid() OR NEW.run_id IS NULL
    OR pg_catalog.current_setting('magickli_retention.o'||actual_oid::text,true) IS DISTINCT FROM NEW.run_id::text
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='advisory' AND l.pid=pg_catalog.pg_backend_pid() AND l.granted
      AND l.classid=((lock_key>>32)&4294967295)::oid AND l.objid=(lock_key&4294967295)::oid AND l.objsubid=1)
    THEN RAISE EXCEPTION 'Maintenance session ownership missing'; END IF;
  now_at:=pg_catalog.clock_timestamp();
  IF NEW.state='started' THEN
    IF NEW.run_id IS NOT DISTINCT FROM OLD.run_id OR NEW.started_at IS NULL OR NEW.started_at>now_at
      OR NEW.started_at<now_at-interval '8 seconds' THEN RAISE EXCEPTION 'Invalid maintenance start'; END IF;
  ELSE
    IF OLD.state<>'started' OR NEW.state NOT IN ('healthy','pending','failed','closed') OR NEW.run_id IS DISTINCT FROM OLD.run_id
      OR NEW.controller_pid IS DISTINCT FROM OLD.controller_pid OR NEW.started_at IS DISTINCT FROM OLD.started_at
      OR NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at OR NEW.finished_at IS NULL
      OR now_at>=OLD.lease_expires_at OR NEW.finished_at>now_at THEN RAISE EXCEPTION 'Stale maintenance completion'; END IF;
  END IF;
  IF OLD.revision>=9007199254740991 THEN RAISE EXCEPTION 'Maintenance revision exhausted'; END IF;
  NEW.revision:=OLD.revision+1;
  RETURN NEW;
END;
$maintenance$;
--> statement-breakpoint
CREATE TRIGGER chat_research_maintenance_change BEFORE INSERT OR UPDATE ON public.chat_research_maintenance
FOR EACH ROW EXECUTE FUNCTION public.chat_research_maintenance_change();

--> statement-breakpoint
CREATE TRIGGER chat_research_maintenance_delete BEFORE DELETE OR TRUNCATE ON public.chat_research_maintenance
FOR EACH STATEMENT EXECUTE FUNCTION public.chat_research_maintenance_change();
