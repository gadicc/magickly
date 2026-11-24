import { and, eq, lt, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { templeJoinFailures } from "../db/schema/memberships";

/** Failed join-code lookups an account may make in a UTC day (plan 098). */
export const JOIN_FAILURES_PER_DAY = 10;

type AttemptDatabase = Pick<PgDatabase<PgQueryResultHKT>, "insert" | "update">;

/** The UTC day ("2026-11-24") a lookup is counted in. */
const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/**
 * Reserves one lookup for an account before its code is checked, in one
 * conditional upsert, so parallel requests cannot pass the limit between
 * a check and a count. Returns false when the day's misses are used up.
 * A code that matches gives its reservation back (`returnJoinAttempt`),
 * so only misses stay counted.
 */
export async function reserveJoinAttempt(
  database: AttemptDatabase,
  userId: string,
  now: Date,
): Promise<boolean> {
  const day = utcDay(now);
  const rows = await database
    .insert(templeJoinFailures)
    .values({ userId, day, failures: 1 })
    .onConflictDoUpdate({
      target: templeJoinFailures.userId,
      set: {
        day,
        failures: sql`case when ${templeJoinFailures.day} = ${day}::date then ${templeJoinFailures.failures} + 1 else 1 end`,
      },
      // A request from before midnight must not reset a newer day's row.
      setWhere: or(
        lt(templeJoinFailures.day, day),
        and(
          eq(templeJoinFailures.day, day),
          sql`${templeJoinFailures.failures} < ${JOIN_FAILURES_PER_DAY}`,
        ),
      ),
    })
    .returning({ userId: templeJoinFailures.userId });
  return rows.length === 1;
}

/**
 * Gives back a reservation whose code matched. `now` is the reservation's
 * own, so a lookup that straddles midnight never takes from the new day.
 */
export async function returnJoinAttempt(
  database: AttemptDatabase,
  userId: string,
  now: Date,
): Promise<void> {
  const day = utcDay(now);
  await database
    .update(templeJoinFailures)
    .set({ failures: sql`${templeJoinFailures.failures} - 1` })
    .where(
      and(
        eq(templeJoinFailures.userId, userId),
        eq(templeJoinFailures.day, day),
        sql`${templeJoinFailures.failures} > 0`,
      ),
    );
}
