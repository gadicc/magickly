CREATE TABLE "chat_research_source_policies" (
	"corpus_version" text PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"policy_json" text NOT NULL,
	"policy_sha256" text NOT NULL,
	CONSTRAINT "chat_research_source_policy_identity" CHECK (length("chat_research_source_policies"."corpus_version")=64 and "chat_research_source_policies"."corpus_version" ~ '^[0-9a-f]{64}$' and length("chat_research_source_policies"."policy_sha256")=64 and "chat_research_source_policies"."policy_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_source_policy_revision" CHECK ("chat_research_source_policies"."revision" between 1 and 9007199254740991),
	CONSTRAINT "chat_research_source_policy_state" CHECK ("chat_research_source_policies"."state" in ('draft','published','revoked')),
	CONSTRAINT "chat_research_source_policy_bytes" CHECK (pg_catalog.octet_length("chat_research_source_policies"."policy_json") between 1 and 8388608),
	CONSTRAINT "chat_research_source_policy_digest" CHECK ("chat_research_source_policies"."policy_sha256"=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("chat_research_source_policies"."policy_json",'UTF8')),'hex'))
);

--> statement-breakpoint
-- App-owned policy epoch. No row is provisioned and no publication writer is installed.
CREATE FUNCTION "public"."chat_research_source_policy_change"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.corpus_version IS DISTINCT FROM OLD.corpus_version OR OLD.revision >= 9007199254740991 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'RESEARCH_POLICY_MUTATION_REFUSED';
    END IF;
    NEW.revision := OLD.revision + 1;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'RESEARCH_POLICY_RESET_REFUSED';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "chat_research_source_policy_update" BEFORE UPDATE ON "public"."chat_research_source_policies"
FOR EACH ROW EXECUTE FUNCTION "public"."chat_research_source_policy_change"();
--> statement-breakpoint
CREATE TRIGGER "chat_research_source_policy_delete" BEFORE DELETE ON "public"."chat_research_source_policies"
FOR EACH STATEMENT EXECUTE FUNCTION "public"."chat_research_source_policy_change"();
--> statement-breakpoint
CREATE TRIGGER "chat_research_source_policy_truncate" BEFORE TRUNCATE ON "public"."chat_research_source_policies"
FOR EACH STATEMENT EXECUTE FUNCTION "public"."chat_research_source_policy_change"();
