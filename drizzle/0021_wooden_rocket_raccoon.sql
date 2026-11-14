CREATE TABLE "chat_research_permits" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"window_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"descriptor_sha256" text NOT NULL,
	"request_sha256" text NOT NULL,
	"source_context_sha256" text NOT NULL,
	"upper_pico" bigint NOT NULL,
	"quote_expires_at" timestamp with time zone NOT NULL,
	"reserved_at" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"dispatch_id" uuid,
	"dispatch_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"reported_pico" bigint,
	"response_sha256" text,
	"answer_sha256" text,
	"result_sha256" text,
	CONSTRAINT "chat_research_permits_identity" CHECK (substring("chat_research_permits"."id"::text from 15 for 1)='7' and substring("chat_research_permits"."id"::text from 20 for 1) in ('8','9','a','b') and substring("chat_research_permits"."operation_id"::text from 15 for 1)='7' and substring("chat_research_permits"."operation_id"::text from 20 for 1) in ('8','9','a','b') and substring("chat_research_permits"."actor_id"::text from 15 for 1)='7' and substring("chat_research_permits"."actor_id"::text from 20 for 1) in ('8','9','a','b') and substring("chat_research_permits"."session_id"::text from 15 for 1)='7' and substring("chat_research_permits"."session_id"::text from 20 for 1) in ('8','9','a','b')),
	CONSTRAINT "chat_research_permits_descriptor_sha256_hash" CHECK ("chat_research_permits"."descriptor_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_permits_request_sha256_hash" CHECK ("chat_research_permits"."request_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_permits_source_context_sha256_hash" CHECK ("chat_research_permits"."source_context_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_permits_response_sha256_hash" CHECK ("chat_research_permits"."response_sha256" is null or "chat_research_permits"."response_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_permits_answer_sha256_hash" CHECK ("chat_research_permits"."answer_sha256" is null or "chat_research_permits"."answer_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_permits_result_sha256_hash" CHECK ("chat_research_permits"."result_sha256" is null or "chat_research_permits"."result_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_permits_dispatch_time" CHECK ("chat_research_permits"."dispatch_at" is null or ("chat_research_permits"."dispatch_at" >= "chat_research_permits"."reserved_at" and "chat_research_permits"."dispatch_at" < "chat_research_permits"."quote_expires_at")),
	CONSTRAINT "chat_research_permits_amount" CHECK ("chat_research_permits"."upper_pico" between 1 and 350000000000 and ("chat_research_permits"."reported_pico" is null or "chat_research_permits"."reported_pico" between 0 and 9007199254740991)),
	CONSTRAINT "chat_research_permits_quote" CHECK ("chat_research_permits"."quote_expires_at" > "chat_research_permits"."reserved_at" and "chat_research_permits"."quote_expires_at" <= "chat_research_permits"."reserved_at" + interval '60 seconds'),
	CONSTRAINT "chat_research_permits_state" CHECK (
      ("chat_research_permits"."state"='reserved' and "chat_research_permits"."dispatch_id" is null and "chat_research_permits"."dispatch_at" is null and "chat_research_permits"."finished_at" is null and "chat_research_permits"."result_sha256" is null and "chat_research_permits"."reported_pico" is null and "chat_research_permits"."response_sha256" is null and "chat_research_permits"."answer_sha256" is null)
      or ("chat_research_permits"."state"='dispatching' and "chat_research_permits"."dispatch_id" is not null and "chat_research_permits"."dispatch_at" is not null and "chat_research_permits"."finished_at" is null and "chat_research_permits"."result_sha256" is null and "chat_research_permits"."reported_pico" is null and "chat_research_permits"."response_sha256" is null and "chat_research_permits"."answer_sha256" is null)
      or ("chat_research_permits"."state" in ('completed','failed','indeterminate') and "chat_research_permits"."dispatch_id" is not null and "chat_research_permits"."dispatch_at" is not null and "chat_research_permits"."finished_at" is not null and "chat_research_permits"."finished_at" >= "chat_research_permits"."dispatch_at" and "chat_research_permits"."result_sha256" is not null)
    ),
	CONSTRAINT "chat_research_permits_completed" CHECK ("chat_research_permits"."state" <> 'completed' or ("chat_research_permits"."reported_pico" is not null and "chat_research_permits"."reported_pico" <= "chat_research_permits"."upper_pico" and "chat_research_permits"."response_sha256" is not null and "chat_research_permits"."answer_sha256" is not null))
);
--> statement-breakpoint
CREATE TABLE "chat_research_windows" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"approval_sha256" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"corpus_version" text NOT NULL,
	"model" text NOT NULL,
	"processor_profile" text NOT NULL,
	"begins_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_requests" integer NOT NULL,
	"per_request_pico" bigint NOT NULL,
	"total_pico" bigint NOT NULL,
	"requests_used" integer DEFAULT 0 NOT NULL,
	"held_pico" bigint DEFAULT 0 NOT NULL,
	"stopped_at" timestamp with time zone,
	CONSTRAINT "chat_research_windows_approval_sha256_unique" UNIQUE("approval_sha256"),
	CONSTRAINT "chat_research_windows_approval_sha256_hash" CHECK ("chat_research_windows"."approval_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_windows_corpus_version_hash" CHECK ("chat_research_windows"."corpus_version" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chat_research_windows_identity" CHECK (substring("chat_research_windows"."id"::text from 15 for 1)='7' and substring("chat_research_windows"."id"::text from 20 for 1) in ('8','9','a','b') and substring("chat_research_windows"."actor_id"::text from 15 for 1)='7' and substring("chat_research_windows"."actor_id"::text from 20 for 1) in ('8','9','a','b')),
	CONSTRAINT "chat_research_windows_profile" CHECK (length("chat_research_windows"."model") between 1 and 128 and "chat_research_windows"."processor_profile" ~ '^[a-zA-Z0-9_-]{1,128}$'),
	CONSTRAINT "chat_research_windows_lifetime" CHECK ("chat_research_windows"."expires_at" > "chat_research_windows"."begins_at" and "chat_research_windows"."expires_at" <= "chat_research_windows"."begins_at" + interval '24 hours'),
	CONSTRAINT "chat_research_windows_count" CHECK ("chat_research_windows"."max_requests" between 1 and 10 and "chat_research_windows"."requests_used" between 0 and "chat_research_windows"."max_requests"),
	CONSTRAINT "chat_research_windows_amount" CHECK ("chat_research_windows"."per_request_pico" between 1 and 350000000000 and "chat_research_windows"."total_pico" between 1 and 3500000000000 and "chat_research_windows"."held_pico" between 0 and "chat_research_windows"."total_pico")
);
--> statement-breakpoint
ALTER TABLE "chat_research_permits" ADD CONSTRAINT "chat_research_permits_window_id_chat_research_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."chat_research_windows"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_research_permits_operation" ON "chat_research_permits" USING btree ("window_id","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_research_permits_one_open" ON "chat_research_permits" USING btree ("window_id") WHERE "chat_research_permits"."state" in ('reserved','dispatching');--> statement-breakpoint
CREATE INDEX "chat_research_permits_owner" ON "chat_research_permits" USING btree ("actor_id","session_id");