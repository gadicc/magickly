import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * The hosted site search's first daily counter. No longer written: since
 * 24 November 2026 the counter is `SEARCH_POOL` in `chat_daily_usage`
 * (`src/limits`). Kept until a later migration drops it, so a deployment
 * still running the old code keeps working while the new one rolls out.
 */
export const siteSearchUsage = pgTable(
  "site_search_usage",
  {
    id: text("id").primaryKey(),
    day: date("day").notNull(),
    queries: integer("queries").notNull(),
  },
  (table) => [check("site_search_usage_positive", sql`${table.queries} > 0`)],
);
