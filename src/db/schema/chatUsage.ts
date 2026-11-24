import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Every daily limit's counters (`src/limits/README.md`): one row a subject
 * (a user, a client's HMAC bucket or a shared pool) for the UTC day it was
 * last reserved on. The name is from when chat was its only user.
 */
export const chatDailyUsage = pgTable(
  "chat_daily_usage",
  {
    subject: text("subject").primaryKey(),
    day: date("day").notNull(),
    submissions: integer("submissions").notNull(),
  },
  (table) => [
    check("chat_daily_usage_positive", sql`${table.submissions} > 0`),
  ],
);
