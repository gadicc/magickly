-- Native prerequisite: install when absent; never silently upgrade or relocate an existing extension.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector' AND n.nspname<>'public') THEN
  RAISE EXCEPTION 'Existing vector extension requires reviewed schema compatibility';
 END IF;
END $$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
--> statement-breakpoint
-- The installed Drizzle migrator shares one transaction across pending files.
-- Restore the incoming path below so later migrations retain their creation schema.
SELECT pg_catalog.set_config('magickli.corpus_0025_search_path',pg_catalog.current_setting('search_path'),true);
--> statement-breakpoint
SET LOCAL search_path=pg_catalog,public,pg_temp;
--> statement-breakpoint
CREATE SCHEMA "chat_research_corpus";
--> statement-breakpoint
CREATE TABLE "chat_research_corpus"."datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"corpus_version" text NOT NULL,
	"manifest_text" text NOT NULL,
	"catalog_text" text NOT NULL,
	"catalog_sha256" text NOT NULL,
	"source_count" integer NOT NULL,
	"unit_count" integer NOT NULL,
	"space_count" integer NOT NULL,
	"sealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "datasets_ids" CHECK (length("chat_research_corpus"."datasets"."id")=64 and "chat_research_corpus"."datasets"."id" ~ '^[0-9a-f]{64}$' and length("chat_research_corpus"."datasets"."corpus_version")=64 and "chat_research_corpus"."datasets"."corpus_version" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "datasets_counts" CHECK ("chat_research_corpus"."datasets"."source_count" between 1 and 32 and "chat_research_corpus"."datasets"."unit_count" between 1 and 75000 and "chat_research_corpus"."datasets"."space_count" between 1 and 3),
	CONSTRAINT "datasets_manifest" CHECK (pg_catalog.octet_length("chat_research_corpus"."datasets"."manifest_text") between 1 and 8192 and "chat_research_corpus"."datasets"."id"=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("chat_research_corpus"."datasets"."manifest_text",'UTF8')),'hex')),
	CONSTRAINT "datasets_catalog" CHECK (pg_catalog.octet_length("chat_research_corpus"."datasets"."catalog_text") between 1 and 33554432 and length("chat_research_corpus"."datasets"."catalog_sha256")=64 and "chat_research_corpus"."datasets"."catalog_sha256"=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("chat_research_corpus"."datasets"."catalog_text",'UTF8')),'hex'))
);
--> statement-breakpoint
CREATE TABLE "chat_research_corpus"."sources" (
	"dataset_id" text NOT NULL,
	"source_id" text NOT NULL,
	"source_version" text NOT NULL,
	"pdf_pages" integer NOT NULL,
	"book_json" text NOT NULL,
	CONSTRAINT "sources_pk" PRIMARY KEY("dataset_id","source_id"),
	CONSTRAINT "sources_identity" CHECK (pg_catalog.octet_length("chat_research_corpus"."sources"."source_id") between 1 and 128 and "chat_research_corpus"."sources"."source_id" ~ '^[A-Za-z0-9_-]+$' and length("chat_research_corpus"."sources"."source_version")=64 and "chat_research_corpus"."sources"."source_version" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sources_metadata" CHECK ("chat_research_corpus"."sources"."pdf_pages" between 1 and 100000 and pg_catalog.octet_length("chat_research_corpus"."sources"."book_json") between 1 and 131072 and pg_catalog.json_typeof("chat_research_corpus"."sources"."book_json"::json)='object')
);
--> statement-breakpoint
CREATE TABLE "chat_research_corpus"."spaces" (
	"dataset_id" text NOT NULL,
	"space_id" text NOT NULL,
	"model_id" text NOT NULL,
	"dimensions" integer NOT NULL,
	"input_prefix" text NOT NULL,
	"model_json" text NOT NULL,
	"vector_count" integer NOT NULL,
	CONSTRAINT "spaces_pk" PRIMARY KEY("dataset_id","space_id"),
	CONSTRAINT "spaces_dimensions_key" UNIQUE("dataset_id","space_id","dimensions"),
	CONSTRAINT "spaces_identity" CHECK (length("chat_research_corpus"."spaces"."space_id")=64 and "chat_research_corpus"."spaces"."space_id" ~ '^[0-9a-f]{64}$' and pg_catalog.octet_length("chat_research_corpus"."spaces"."model_id") between 1 and 128 and "chat_research_corpus"."spaces"."dimensions" in (1536,3072) and "chat_research_corpus"."spaces"."vector_count" between 1 and 75000),
	CONSTRAINT "spaces_metadata" CHECK (pg_catalog.octet_length("chat_research_corpus"."spaces"."input_prefix") <= 1024 and pg_catalog.octet_length("chat_research_corpus"."spaces"."model_json") between 1 and 8192 and pg_catalog.json_typeof("chat_research_corpus"."spaces"."model_json"::json)='object')
);
--> statement-breakpoint
CREATE TABLE "chat_research_corpus"."unit_vectors" (
	"dataset_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"space_id" text NOT NULL,
	"input_id" text NOT NULL,
	CONSTRAINT "unit_vectors_pk" PRIMARY KEY("dataset_id","unit_id","space_id")
);
--> statement-breakpoint
CREATE TABLE "chat_research_corpus"."units" (
	"dataset_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"source_id" text NOT NULL,
	"page_start" integer NOT NULL,
	"page_end" integer NOT NULL,
	"extraction" text NOT NULL,
	"text_sha256" text NOT NULL,
	"body" text NOT NULL,
	CONSTRAINT "units_pk" PRIMARY KEY("dataset_id","unit_id"),
	CONSTRAINT "units_identity" CHECK (pg_catalog.octet_length("chat_research_corpus"."units"."unit_id") between 1 and 128 and "chat_research_corpus"."units"."unit_id" ~ '^[A-Za-z0-9_.:-]+$'),
	CONSTRAINT "units_pages" CHECK ("chat_research_corpus"."units"."page_start" >= 1 and "chat_research_corpus"."units"."page_end" >= "chat_research_corpus"."units"."page_start" and "chat_research_corpus"."units"."extraction" in ('native_text','unverified_ocr')),
	CONSTRAINT "units_body" CHECK (length("chat_research_corpus"."units"."body") between 1 and 16000 and pg_catalog.octet_length("chat_research_corpus"."units"."body") between 1 and 64000 and length("chat_research_corpus"."units"."text_sha256")=64 and "chat_research_corpus"."units"."text_sha256"=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to("chat_research_corpus"."units"."body",'UTF8')),'hex'))
);
--> statement-breakpoint
CREATE TABLE "chat_research_corpus"."vectors" (
	"dataset_id" text NOT NULL,
	"space_id" text NOT NULL,
	"input_id" text NOT NULL,
	"input_sha256" text NOT NULL,
	"dimensions" integer NOT NULL,
	"vector_sha256" text NOT NULL,
	"embedding" vector NOT NULL,
	CONSTRAINT "vectors_pk" PRIMARY KEY("dataset_id","space_id","input_id"),
	CONSTRAINT "vectors_exact_input_key" UNIQUE("dataset_id","space_id","input_sha256"),
	CONSTRAINT "vectors_input" CHECK (pg_catalog.octet_length("chat_research_corpus"."vectors"."input_id") between 1 and 128 and "chat_research_corpus"."vectors"."input_id" ~ '^[A-Za-z0-9_.:-]+$' and length("chat_research_corpus"."vectors"."input_sha256")=64 and "chat_research_corpus"."vectors"."input_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "vectors_bytes" CHECK (public.vector_dims("chat_research_corpus"."vectors"."embedding")="chat_research_corpus"."vectors"."dimensions" and public.vector_norm("chat_research_corpus"."vectors"."embedding")>0 and length("chat_research_corpus"."vectors"."vector_sha256")=64 and "chat_research_corpus"."vectors"."vector_sha256"=pg_catalog.encode(pg_catalog.sha256(public.vector_send("chat_research_corpus"."vectors"."embedding")),'hex'))
);
--> statement-breakpoint
ALTER TABLE "chat_research_corpus"."sources" ADD CONSTRAINT "sources_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "chat_research_corpus"."datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_research_corpus"."spaces" ADD CONSTRAINT "spaces_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "chat_research_corpus"."datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_research_corpus"."unit_vectors" ADD CONSTRAINT "unit_vectors_unit_fk" FOREIGN KEY ("dataset_id","unit_id") REFERENCES "chat_research_corpus"."units"("dataset_id","unit_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_research_corpus"."unit_vectors" ADD CONSTRAINT "unit_vectors_vector_fk" FOREIGN KEY ("dataset_id","space_id","input_id") REFERENCES "chat_research_corpus"."vectors"("dataset_id","space_id","input_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_research_corpus"."units" ADD CONSTRAINT "units_source_fk" FOREIGN KEY ("dataset_id","source_id") REFERENCES "chat_research_corpus"."sources"("dataset_id","source_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_research_corpus"."vectors" ADD CONSTRAINT "vectors_space_fk" FOREIGN KEY ("dataset_id","space_id","dimensions") REFERENCES "chat_research_corpus"."spaces"("dataset_id","space_id","dimensions") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "units_source_idx" ON "chat_research_corpus"."units" USING btree ("dataset_id","source_id");--> statement-breakpoint
-- A dataset is visible only after one complete transaction seals it. No active pointer/source grant is created.
CREATE FUNCTION chat_research_corpus.guard_dataset() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
    AND NEW.sealed_at>=OLD.created_at AND pg_catalog.isfinite(NEW.sealed_at)
    AND (pg_catalog.to_jsonb(NEW)-'sealed_at') IS NOT DISTINCT FROM (pg_catalog.to_jsonb(OLD)-'sealed_at') THEN
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Corpus datasets are immutable except for their first seal';
END $$;
--> statement-breakpoint
CREATE FUNCTION chat_research_corpus.guard_child() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE sealed timestamptz;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Corpus rows are immutable'; END IF;
 SELECT sealed_at INTO sealed FROM chat_research_corpus.datasets WHERE id=NEW.dataset_id FOR SHARE;
 IF NOT FOUND OR sealed IS NOT NULL THEN RAISE EXCEPTION 'Corpus dataset is unavailable for insertion'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION chat_research_corpus.check_complete() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE d chat_research_corpus.datasets%ROWTYPE; c jsonb; m jsonb;
BEGIN
 SELECT * INTO STRICT d FROM chat_research_corpus.datasets WHERE id=NEW.id;
 IF d.sealed_at IS NULL THEN RAISE EXCEPTION 'Corpus dataset must seal before commit'; END IF;
 c:=d.catalog_text::jsonb; m:=d.manifest_text::jsonb;
 IF (c->>'schema_version') IS DISTINCT FROM '1'
 OR (m->>'schema_version') IS DISTINCT FROM '1'
 OR (m->>'purpose') IS DISTINCT FROM 'magickli-private-runtime-corpus-v1'
 OR (m->>'corpus_version') IS DISTINCT FROM d.corpus_version
 OR (m->>'source_count')::integer IS DISTINCT FROM d.source_count
 OR (m->>'unit_count')::integer IS DISTINCT FROM d.unit_count
 OR (m->'files'->'catalog.json'->>'sha256') IS DISTINCT FROM d.catalog_sha256
 OR (m->'files'->'catalog.json'->>'bytes')::bigint IS DISTINCT FROM pg_catalog.octet_length(d.catalog_text)::bigint
 OR pg_catalog.jsonb_array_length(c->'sources') IS DISTINCT FROM d.source_count
 OR (SELECT count(DISTINCT x->>'source_id') FROM pg_catalog.jsonb_array_elements(c->'sources') x) IS DISTINCT FROM d.source_count::bigint
 OR (SELECT count(*) FROM chat_research_corpus.sources WHERE dataset_id=d.id) IS DISTINCT FROM d.source_count::bigint
 OR (SELECT count(*) FROM chat_research_corpus.units WHERE dataset_id=d.id) IS DISTINCT FROM d.unit_count::bigint
 OR (SELECT count(*) FROM chat_research_corpus.spaces WHERE dataset_id=d.id) IS DISTINCT FROM d.space_count::bigint
 OR (SELECT count(*) FROM chat_research_corpus.unit_vectors WHERE dataset_id=d.id) IS DISTINCT FROM (d.unit_count::bigint*d.space_count)
 THEN RAISE EXCEPTION 'Corpus metadata or membership is incomplete'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'sources') x
  LEFT JOIN chat_research_corpus.sources s ON s.dataset_id=d.id AND s.source_id=x->>'source_id'
  WHERE s.source_id IS NULL OR s.source_version IS DISTINCT FROM x->>'source_version'
    OR s.pdf_pages IS DISTINCT FROM (x->>'pdf_pages')::integer
    OR s.book_json::jsonb IS DISTINCT FROM x->'book'
 ) THEN RAISE EXCEPTION 'Corpus source projection mismatch'; END IF;
 IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(c->'sources') x CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(x->'units') y) IS DISTINCT FROM d.unit_count::bigint
 OR (SELECT count(DISTINCT y->>'id') FROM pg_catalog.jsonb_array_elements(c->'sources') x CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(x->'units') y) IS DISTINCT FROM d.unit_count::bigint
 OR EXISTS (
  SELECT 1 FROM pg_catalog.jsonb_array_elements(c->'sources') x CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(x->'units') y
  LEFT JOIN chat_research_corpus.units u ON u.dataset_id=d.id AND u.unit_id=y->>'id'
  WHERE u.unit_id IS NULL OR u.source_id IS DISTINCT FROM x->>'source_id'
   OR u.page_start IS DISTINCT FROM (y->>'page_start')::integer OR u.page_end IS DISTINCT FROM (y->>'page_end')::integer
   OR u.page_end>(x->>'pdf_pages')::integer OR u.extraction IS DISTINCT FROM y->>'extraction'
   OR u.text_sha256 IS DISTINCT FROM y->>'text_sha256'
 ) THEN RAISE EXCEPTION 'Corpus unit projection mismatch'; END IF;
 IF EXISTS (
  SELECT 1 FROM chat_research_corpus.spaces s WHERE s.dataset_id=d.id AND
   ((SELECT count(*) FROM chat_research_corpus.vectors v WHERE v.dataset_id=s.dataset_id AND v.space_id=s.space_id) IS DISTINCT FROM s.vector_count::bigint
    OR (s.model_json::jsonb->>'id') IS DISTINCT FROM s.model_id
    OR (s.model_json::jsonb->>'dimensions')::integer IS DISTINCT FROM s.dimensions
    OR (s.model_json::jsonb->>'prefix') IS DISTINCT FROM s.input_prefix)
 ) OR EXISTS (
  SELECT 1 FROM chat_research_corpus.unit_vectors l
  JOIN chat_research_corpus.units u ON u.dataset_id=l.dataset_id AND u.unit_id=l.unit_id
  JOIN chat_research_corpus.spaces s ON s.dataset_id=l.dataset_id AND s.space_id=l.space_id
  JOIN chat_research_corpus.vectors v ON v.dataset_id=l.dataset_id AND v.space_id=l.space_id AND v.input_id=l.input_id
  WHERE l.dataset_id=d.id AND v.input_sha256 IS DISTINCT FROM pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.input_prefix||u.body,'UTF8')),'hex')
 ) OR EXISTS (SELECT 1 FROM chat_research_corpus.vectors v WHERE v.dataset_id=d.id AND NOT EXISTS (SELECT 1 FROM chat_research_corpus.unit_vectors l WHERE l.dataset_id=v.dataset_id AND l.space_id=v.space_id AND l.input_id=v.input_id)) THEN RAISE EXCEPTION 'Corpus embedding membership or exact input mismatch'; END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER datasets_immutable BEFORE UPDATE OR DELETE ON chat_research_corpus.datasets FOR EACH ROW EXECUTE FUNCTION chat_research_corpus.guard_dataset();
--> statement-breakpoint
CREATE TRIGGER datasets_no_truncate BEFORE TRUNCATE ON chat_research_corpus.datasets FOR EACH STATEMENT EXECUTE FUNCTION chat_research_corpus.guard_dataset();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER datasets_complete AFTER INSERT OR UPDATE ON chat_research_corpus.datasets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION chat_research_corpus.check_complete();
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['sources','units','spaces','vectors','unit_vectors'] LOOP
  EXECUTE pg_catalog.format('CREATE TRIGGER corpus_immutable BEFORE INSERT OR UPDATE OR DELETE ON chat_research_corpus.%I FOR EACH ROW EXECUTE FUNCTION chat_research_corpus.guard_child()',t);
  EXECUTE pg_catalog.format('CREATE TRIGGER corpus_no_truncate BEFORE TRUNCATE ON chat_research_corpus.%I FOR EACH STATEMENT EXECUTE FUNCTION chat_research_corpus.guard_child()',t);
 END LOOP;
END $$;
--> statement-breakpoint
-- Revoke inherited default grants only on these NEW private objects; preserve global defaults and all existing app objects.
REVOKE ALL ON SCHEMA chat_research_corpus FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA chat_research_corpus FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA chat_research_corpus FROM PUBLIC;
--> statement-breakpoint
DO $$ DECLARE x record; BEGIN
 FOR x IN SELECT DISTINCT r.rolname FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE n.nspname='chat_research_corpus' AND a.grantee<>n.nspowner LOOP
  EXECUTE pg_catalog.format('REVOKE ALL ON SCHEMA chat_research_corpus FROM %I',x.rolname);
 END LOOP;
 FOR x IN SELECT DISTINCT c.relname,r.rolname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE n.nspname='chat_research_corpus' AND c.relkind='r' AND a.grantee<>c.relowner LOOP
  EXECUTE pg_catalog.format('REVOKE ALL ON TABLE chat_research_corpus.%I FROM %I',x.relname,x.rolname);
 END LOOP;
 FOR x IN SELECT DISTINCT p.proname,r.rolname FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE n.nspname='chat_research_corpus' AND a.grantee<>p.proowner LOOP
  EXECUTE pg_catalog.format('REVOKE ALL ON FUNCTION chat_research_corpus.%I() FROM %I',x.proname,x.rolname);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a WHERE n.nspname='chat_research_corpus' AND (n.nspowner<>current_user::regrole OR a.grantee<>n.nspowner))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE n.nspname='chat_research_corpus' AND c.relkind='r' AND (c.relowner<>n.nspowner OR a.grantee<>c.relowner))
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_attribute c JOIN pg_catalog.pg_class t ON t.oid=c.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(c.attacl) a WHERE n.nspname='chat_research_corpus' AND a.grantee<>t.relowner)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE n.nspname='chat_research_corpus' AND (p.proowner<>n.nspowner OR a.grantee<>p.proowner))
 THEN RAISE EXCEPTION 'Private corpus object privileges require review'; END IF;
END $$;
--> statement-breakpoint
SELECT pg_catalog.set_config('search_path',pg_catalog.current_setting('magickli.corpus_0025_search_path'),true);
