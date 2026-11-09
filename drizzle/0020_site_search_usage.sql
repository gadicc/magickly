CREATE TABLE "site_search_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"queries" integer NOT NULL,
	CONSTRAINT "site_search_usage_positive" CHECK ("site_search_usage"."queries" > 0)
);
