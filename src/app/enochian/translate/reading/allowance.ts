import {
  ANONYMOUS_DAILY_CHAT_LIMIT,
  dailyUsageLeft,
  reserveDailyUsage,
  returnDailyUsage,
  USER_DAILY_CHAT_LIMIT,
  usageDay,
  usageSubject,
} from "@/app/chat/usage";
import type { ReadingDatabase } from "./database.ts";
import { CLIENT_DAILY_UNITS } from "./limits.ts";

export { CLIENT_DAILY_UNITS };

/**
 * What a reading reserves from the daily allowance (plan 081, S4, and
 * decision 2): its units, from the reader's own allowance when signed in
 * or the anonymous pool when not, the same counters chat uses. A
 * signed-out client may also use at most `CLIENT_DAILY_UNITS` a day of the
 * pool; its bucket and the pool are reserved in one transaction, so both
 * are counted or neither. A reservation is never given back: a failed call
 * may still have cost.
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

/** Thrown inside the transaction to roll back the client's reservation. */
class Refused extends Error {
  constructor(readonly scope: "client" | "anonymous") {
    super(scope);
  }
}

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
    const subject = usageSubject(who.userId);
    if (await reserveDailyUsage(db, subject, USER_DAILY_CHAT_LIMIT, units, now))
      return { ok: true, scope: "user", resetAt };
    return {
      ok: false,
      scope: "user",
      left: await dailyUsageLeft(db, subject, USER_DAILY_CHAT_LIMIT, now),
      limit: USER_DAILY_CHAT_LIMIT,
      resetAt,
    };
  }
  const pool = usageSubject(null);
  try {
    await db.transaction(async (tx) => {
      if (
        !(await reserveDailyUsage(
          tx,
          who.client,
          CLIENT_DAILY_UNITS,
          units,
          now,
        ))
      )
        throw new Refused("client");
      if (
        !(await reserveDailyUsage(
          tx,
          pool,
          ANONYMOUS_DAILY_CHAT_LIMIT,
          units,
          now,
        ))
      )
        throw new Refused("anonymous");
    });
    return { ok: true, scope: "anonymous", resetAt };
  } catch (error) {
    if (!(error instanceof Refused)) throw error;
    const [client, shared] = await Promise.all([
      dailyUsageLeft(db, who.client, CLIENT_DAILY_UNITS, now),
      dailyUsageLeft(db, pool, ANONYMOUS_DAILY_CHAT_LIMIT, now),
    ]);
    return {
      ok: false,
      scope: error.scope,
      left: Math.min(client, shared),
      limit:
        error.scope === "client"
          ? CLIENT_DAILY_UNITS
          : ANONYMOUS_DAILY_CHAT_LIMIT,
      resetAt,
    };
  }
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
      await returnDailyUsage(tx, usageSubject(who.userId), units, now);
      return;
    }
    await returnDailyUsage(tx, who.client, units, now);
    await returnDailyUsage(tx, usageSubject(null), units, now);
  });
}
