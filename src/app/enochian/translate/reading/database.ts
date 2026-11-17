import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** The queries the reading's store, ledger and allowance make. */
export type ReadingSql = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "insert" | "update" | "delete"
>;

/**
 * The database the reading runs on: one that can run a transaction, for the
 * client's and the pool's reservations together (plan 081, S4). The route
 * passes `@/db/neonFull`'s; tests pass PGlite's.
 */
export interface ReadingDatabase extends ReadingSql {
  transaction<T>(work: (tx: ReadingSql) => Promise<T>): Promise<T>;
}

/** A day in milliseconds: how long a stored reading is served (S7). */
export const DAY_MS = 24 * 60 * 60 * 1000;
