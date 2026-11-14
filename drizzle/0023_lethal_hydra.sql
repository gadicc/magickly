CREATE TABLE "chat_research_artifacts" (
	"permit_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"packet_json" text,
	"packet_sha256" text NOT NULL,
	"job_created_at" timestamp with time zone NOT NULL,
	"stored_at" timestamp with time zone NOT NULL,
	"retain_until" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone,
	CONSTRAINT "chat_research_artifacts_permit_id_kind_pk" PRIMARY KEY("permit_id","kind"),
	CONSTRAINT "chat_research_artifacts_identity" CHECK (substring("chat_research_artifacts"."permit_id"::text from 15 for 1)='7' and substring("chat_research_artifacts"."permit_id"::text from 20 for 1) in ('8','9','a','b') and "chat_research_artifacts"."kind" in ('request','result') and length("chat_research_artifacts"."packet_sha256")=64 and "chat_research_artifacts"."packet_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_artifacts_retention" CHECK (pg_catalog.isfinite("chat_research_artifacts"."job_created_at") and pg_catalog.isfinite("chat_research_artifacts"."stored_at") and pg_catalog.isfinite("chat_research_artifacts"."retain_until") and ("chat_research_artifacts"."purged_at" is null or pg_catalog.isfinite("chat_research_artifacts"."purged_at")) and "chat_research_artifacts"."retain_until"="chat_research_artifacts"."job_created_at"+interval '720 hours' and "chat_research_artifacts"."stored_at">="chat_research_artifacts"."job_created_at" and "chat_research_artifacts"."stored_at"<"chat_research_artifacts"."retain_until"),
	CONSTRAINT "chat_research_artifacts_body" CHECK (("chat_research_artifacts"."packet_json" is not null and "chat_research_artifacts"."purged_at" is null and pg_catalog.octet_length("chat_research_artifacts"."packet_json") between 1 and (case when "chat_research_artifacts"."kind"='request' then 262144 else 2097152 end) and "chat_research_artifacts"."packet_sha256"=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("chat_research_artifacts"."packet_json",'UTF8')),'hex')) or ("chat_research_artifacts"."packet_json" is null and "chat_research_artifacts"."purged_at" is not null and "chat_research_artifacts"."purged_at">="chat_research_artifacts"."retain_until"))
);
--> statement-breakpoint
ALTER TABLE "chat_research_artifacts" ADD CONSTRAINT "chat_research_artifacts_permit_id_chat_research_permits_id_fk" FOREIGN KEY ("permit_id") REFERENCES "public"."chat_research_permits"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_research_artifacts_expiry" ON "chat_research_artifacts" USING btree ("retain_until") WHERE "chat_research_artifacts"."purged_at" is null;
--> statement-breakpoint
-- App-owned: immutable packets may only become an expired one-way tombstone.
CREATE FUNCTION public.chat_research_artifact_change() RETURNS trigger
LANGUAGE plpgsql AS $body$
DECLARE now_at timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF TG_OP = 'INSERT' AND NEW.packet_json IS NOT NULL AND NEW.purged_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.packet_json IS NOT NULL AND OLD.purged_at IS NULL
      AND NEW.packet_json IS NULL AND NEW.purged_at IS NOT NULL
      AND NEW.purged_at >= OLD.retain_until AND NEW.purged_at <= now_at
      AND now_at >= OLD.retain_until
      AND ROW(NEW.permit_id,NEW.kind,NEW.packet_sha256,NEW.job_created_at,NEW.stored_at,NEW.retain_until)
        IS NOT DISTINCT FROM ROW(OLD.permit_id,OLD.kind,OLD.packet_sha256,OLD.job_created_at,OLD.stored_at,OLD.retain_until)
    THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'Private research artifact immutable';
END
$body$;
--> statement-breakpoint
CREATE TRIGGER chat_research_artifact_update BEFORE UPDATE ON public.chat_research_artifacts
FOR EACH ROW EXECUTE FUNCTION public.chat_research_artifact_change();
--> statement-breakpoint
CREATE TRIGGER chat_research_artifact_delete BEFORE DELETE OR TRUNCATE ON public.chat_research_artifacts
FOR EACH STATEMENT EXECUTE FUNCTION public.chat_research_artifact_change();
--> statement-breakpoint
CREATE TRIGGER chat_research_artifact_insert BEFORE INSERT ON public.chat_research_artifacts
FOR EACH ROW EXECUTE FUNCTION public.chat_research_artifact_change();
