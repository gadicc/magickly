CREATE TABLE "chat_daily_usage" (
	"subject" text PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"submissions" integer NOT NULL,
	CONSTRAINT "chat_daily_usage_positive" CHECK ("chat_daily_usage"."submissions" > 0)
);
