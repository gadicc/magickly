import type { SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** The queries the reading's store, ledger and allowance make. */
export type ReadingSql = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "insert" | "update" | "delete"
>;

/**
 * The database the reading runs on: one that can run a transaction, for
 * giving a stopped reading's units back to its counters together (plan
 * 081, S4), and a raw statement, for reserving them together. The route
 * passes `@/db/neonFull`'s; tests pass PGlite's.
 */
export interface ReadingDatabase extends ReadingSql {
  transaction<T>(work: (tx: ReadingSql) => Promise<T>): Promise<T>;
  /** A raw statement, for `reserveTogether` (`src/limits/counters.ts`). */
  execute(query: SQL): PromiseLike<unknown>;
}

/** A day in milliseconds: how long a stored reading is served (S7). */
export const DAY_MS = 24 * 60 * 60 * 1000;
