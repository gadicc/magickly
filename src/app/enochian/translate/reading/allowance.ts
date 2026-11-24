import {
  clientBucket,
  dailyUsageLeft,
  poolBucket,
  reserveDailyUsage,
  reserveTogether,
  returnDailyUsage,
  usageDay,
  userSubject,
} from "@/limits/counters";
import { ANONYMOUS_POOL, CHAT_USER, READING_CLIENT } from "@/limits/policies";
import type { ReadingDatabase } from "./database.ts";

/**
 * What a reading reserves from the daily allowance (plan 081, S4, and
 * decision 2): its units, from the reader's own allowance when signed in
 * or the anonymous pool when not, the same counters chat uses. A
 * signed-out client may also use at most `READING_CLIENT.limit` a day of
 * the pool; its bucket and the pool are reserved in one transaction, so
 * both are counted or neither (`src/limits`). A reservation is never given
 * back: a failed call may still have cost.
 */

/** Whose allowance a refusal ran out of. */
export type AllowanceScope = "user" | "anonymous" | "client";

/** A refusal: what is left to the reader, of what, and when it resets. */
export interface AllowanceRefusal {
  ok: false;
  scope: AllowanceScope;
  /** Units left today (fewer than the reading needs). */
  left: number;
  /** The allowance's daily size. */
  limit: number;
  resetAt: Date;
}

export type AllowanceOutcome =
  | { ok: true; scope: "user" | "anonymous"; resetAt: Date }
  | AllowanceRefusal;

/**
 * Reserves a reading's units: the user's, or the client's and the pool's
 * together (`client` is its bucket, `clientSubject`).
 */
export async function reserveReading(
  db: ReadingDatabase,
  who: { userId: string | null; client: string },
  units: number,
  now: Date,
): Promise<AllowanceOutcome> {
  const { resetAt } = usageDay(now);
  if (who.userId) {
    const subject = userSubject(who.userId);
    if (await reserveDailyUsage(db, subject, CHAT_USER.limit, units, now))
      return { ok: true, scope: "user", resetAt };
    return {
      ok: false,
      scope: "user",
      left: await dailyUsageLeft(db, subject, CHAT_USER.limit, now),
      limit: CHAT_USER.limit,
      resetAt,
    };
  }
  const client = clientBucket(READING_CLIENT, who.client);
  const pool = poolBucket(ANONYMOUS_POOL);
  const reserved = await reserveTogether(db, [client, pool], units, now);
  if (reserved.ok) return { ok: true, scope: "anonymous", resetAt };
  const scope = reserved.refused === client ? "client" : "anonymous";
  const [clientLeft, poolLeft] = await Promise.all([
    dailyUsageLeft(db, client.subject, client.limit, now),
    dailyUsageLeft(db, pool.subject, pool.limit, now),
  ]);
  return {
    ok: false,
    scope,
    left: Math.min(clientLeft, poolLeft),
    limit: reserved.refused.limit,
    resetAt,
  };
}

/**
 * Gives a reading's units back, when it was stopped before any call was
 * made (the ceiling, checked again atomically after the reservation): the
 * user's, or the client's and the pool's together.
 */
export async function returnReading(
  db: ReadingDatabase,
  who: { userId: string | null; client: string },
  units: number,
  now: Date,
): Promise<void> {
  // One transaction, each counter locked as it is changed.
  await db.transaction(async (tx) => {
    if (who.userId) {
      await returnDailyUsage(tx, userSubject(who.userId), units, now);
      return;
    }
    await returnDailyUsage(tx, who.client, units, now);
    await returnDailyUsage(tx, ANONYMOUS_POOL.subject, units, now);
  });
}
