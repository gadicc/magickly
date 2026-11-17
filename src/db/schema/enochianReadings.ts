import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });

/**
 * The AI reading's shared store (plan 081, S7): one row a passage and prompt
 * version, answered free to anyone who sends the same text within a day.
 * It holds the passage as the prompt carries it and the checked reading of
 * each part (never the model's raw reply). Rows older than a day are never
 * served; each request deletes them, and the daily job deletes any left.
 */
export const enochianReadings = pgTable(
  "enochian_readings",
  {
    /** The prompt version (plan 081, S1). */
    version: text("version").notNull(),
    /** The passage as the prompt carries it. */
    passage: text("passage").notNull(),
    /** Each part's status and checked reading, in order; null if not read. */
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    /** Every part is read. */
    complete: boolean("complete").notNull(),
    /** The request reading it now, while its lease lasts. */
    claim: text("claim"),
    /** When the reading's lease ends: a concurrent request waits till then. */
    pendingUntil: instant("pending_until"),
    /** When the reading was made: it is served for a day from then. */
    createdAt: instant("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.version, table.passage] }),
    index("enochian_readings_created_at").on(table.createdAt),
  ],
);

/**
 * The AI reading's spending by UTC day (plan 081, S4), in millionths of a
 * dollar: each call holds its worst case before it is made and settles to
 * the gateway's reported cost after. Readings stop when a hold would pass
 * the day's ceiling.
 */
export const enochianReadingSpend = pgTable(
  "enochian_reading_spend",
  {
    day: date("day").primaryKey(),
    microUsd: bigint("micro_usd", { mode: "number" }).notNull(),
  },
  (table) => [
    check("enochian_reading_spend_not_negative", sql`${table.microUsd} >= 0`),
  ],
);

/**
 * The AI reading's switch (plan 081, S4): a row with `off` true turns
 * readings off for everyone at once, read on every request. No row, or
 * `off` false, leaves them on.
 */
export const enochianReadingSwitch = pgTable(
  "enochian_reading_switch",
  {
    id: text("id").primaryKey(),
    off: boolean("off").notNull(),
    changedAt: instant("changed_at").notNull().defaultNow(),
  },
  (table) => [
    check("enochian_reading_switch_one_row", sql`${table.id} = 'readings'`),
  ],
);
