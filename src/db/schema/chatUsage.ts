import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text } from "drizzle-orm/pg-core";

/** One reusable UTC-day counter per user, plus one shared anonymous counter. */
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
