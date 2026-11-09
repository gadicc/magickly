import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, text } from "drizzle-orm/pg-core";

/** One reusable global UTC-day allowance for hosted site-search queries. */
export const siteSearchUsage = pgTable(
  "site_search_usage",
  {
    id: text("id").primaryKey(),
    day: date("day").notNull(),
    queries: integer("queries").notNull(),
  },
  (table) => [check("site_search_usage_positive", sql`${table.queries} > 0`)],
);
