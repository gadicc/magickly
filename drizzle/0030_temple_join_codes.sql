CREATE TABLE "temple_join_failures" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"failures" integer NOT NULL,
	CONSTRAINT "temple_join_failures_positive" CHECK ("temple_join_failures"."failures" > 0)
);
--> statement-breakpoint
ALTER TABLE "temple_join_failures" ADD CONSTRAINT "temple_join_failures_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Plan 098, decision 3: every existing join code, typed by hand or
-- imported, is replaced by a server-made one: 20 Crockford base32
-- characters in four groups of five. Each character is the low five bits
-- of the first byte of its own gen_random_uuid() (a strong random source;
-- that byte of a version-4 UUID is wholly random). The subquery refers to
-- the row, so PostgreSQL draws a new code for each row.
UPDATE "temple_invites" AS "invite" SET "join_pass" = (
	SELECT string_agg(
		substr('0123456789abcdefghjkmnpqrstvwxyz', (get_byte(uuid_send(gen_random_uuid()), 0) & 31) + 1, 1)
			|| CASE WHEN "position" IN (4, 9, 14) THEN '-' ELSE '' END,
		'' ORDER BY "position"
	)
	FROM generate_series(0, 19) AS "position"
	WHERE "invite"."temple_id" IS NOT NULL
);
