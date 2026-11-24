import { and, eq, lt, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import type { ClientPolicy, PoolPolicy } from "./policies.ts";

/**
 * The daily counters every policy in `policies.ts` is kept in: one row a
 * subject in `chat_daily_usage`, for the UTC day it was last reserved on.
 * A reservation is atomic, so concurrent requests on any instance can't
 * overshoot a limit; `reserveTogether` takes several counters or none.
 */

/** Where a reservation runs: the database, or a transaction on it. */
export type UsageDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "insert" | "select"
>;

/**
 * A database that can run a transaction (`@/db/neonFull`'s; the HTTP
 * client `@/db/neon` can't), for counters reserved together.
 */
export interface TransactionalUsageDatabase extends UsageDatabase {
  transaction<T>(work: (tx: UsageDatabase) => Promise<T>): Promise<T>;
}

/** One counter to reserve from: its subject and its daily limit. */
export interface Bucket {
  subject: string;
  limit: number;
}

/** A UTC day ("2026-10-16") and the midnight that ends it. */
export function usageDay(now: Date) {
  const day = now.toISOString().slice(0, 10);
  const resetAt = new Date(`${day}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { day, resetAt };
}

/** A signed-in reader's counter subject (`CHAT_USER`). */
export const userSubject = (userId: string) => `user:${userId}`;

/** A pool's bucket. */
export const poolBucket = (policy: PoolPolicy): Bucket => ({
  subject: policy.subject,
  limit: policy.limit,
});

/** A client's bucket, its subject from `requestClientSubject`. */
export const clientBucket = (
  policy: ClientPolicy,
  subject: string,
): Bucket => ({
  subject,
  limit: policy.limit,
});

/**
 * Atomically adds `units` to a subject's counter for the day `now` falls
 * in, if that keeps it within `limit`; returns whether it did.
 */
export async function reserveDailyUsage(
  database: UsageDatabase,
  subject: string,
  limit: number,
  units: number,
  now: Date,
): Promise<boolean> {
  if (!(Number.isInteger(units) && units > 0 && units <= limit)) return false;
  const { day } = usageDay(now);
  const rows = await database
    .insert(chatDailyUsage)
    .values({ subject, day, submissions: units })
    .onConflictDoUpdate({
      target: chatDailyUsage.subject,
      set: {
        day,
        submissions: sql`case when ${chatDailyUsage.day} = ${day}::date then ${chatDailyUsage.submissions} + ${units} else ${units} end`,
      },
      // A stale request from before midnight must not reset a newer day's row.
      setWhere: or(
        lt(chatDailyUsage.day, day),
        and(
          eq(chatDailyUsage.day, day),
          sql`${chatDailyUsage.submissions} + ${units} <= ${limit}`,
        ),
      ),
    })
    .returning({ subject: chatDailyUsage.subject });
  return rows.length === 1;
}

/** Thrown inside the transaction to roll back the buckets already taken. */
class Refused extends Error {
  constructor(readonly bucket: Bucket) {
    super(bucket.subject);
  }
}

/** Taken from every bucket, or refused by the first that was full. */
export type Reservation = { ok: true } | { ok: false; refused: Bucket };

/**
 * Reserves `units` from every bucket in one transaction, in order, so all
 * are counted or none is: put the narrowest first (the client's), so a
 * client over its own limit never touches a shared pool's row.
 */
export async function reserveTogether(
  db: TransactionalUsageDatabase,
  buckets: readonly Bucket[],
  units: number,
  now: Date,
): Promise<Reservation> {
  try {
    await db.transaction(async (tx) => {
      for (const one of buckets)
        if (!(await reserveDailyUsage(tx, one.subject, one.limit, units, now)))
          throw new Refused(one);
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, refused: error.bucket };
    throw error;
  }
}

/**
 * Takes `units` back off a subject's counter for the day `now` falls in,
 * for a reservation whose work was never started (an AI reading stopped
 * before any model call). A row that would reach zero is deleted, as if
 * never reserved; another day's row is left alone. Run it inside a
 * transaction: it locks the row first (`for update`), so concurrent
 * refunds of one subject are applied one after another and none is lost.
 */
export async function returnDailyUsage(
  tx: Pick<PgDatabase<PgQueryResultHKT>, "select" | "update" | "delete">,
  subject: string,
  units: number,
  now: Date,
): Promise<void> {
  const { day } = usageDay(now);
  const mine = and(
    eq(chatDailyUsage.subject, subject),
    eq(chatDailyUsage.day, day),
  );
  const [row] = await tx
    .select({ submissions: chatDailyUsage.submissions })
    .from(chatDailyUsage)
    .where(mine)
    .for("update");
  if (!row) return;
  if (row.submissions <= units) await tx.delete(chatDailyUsage).where(mine);
  else
    await tx
      .update(chatDailyUsage)
      .set({ submissions: row.submissions - units })
      .where(mine);
}

/** What is left of a subject's counter today (informational, not atomic). */
export async function dailyUsageLeft(
  database: UsageDatabase,
  subject: string,
  limit: number,
  now: Date,
): Promise<number> {
  const { day } = usageDay(now);
  const [row] = await database
    .select({ submissions: chatDailyUsage.submissions })
    .from(chatDailyUsage)
    .where(
      and(eq(chatDailyUsage.subject, subject), eq(chatDailyUsage.day, day)),
    );
  return Math.max(0, limit - (row?.submissions ?? 0));
}

/**
 * A refusal's response headers: `no-store` above all, so the CDN never
 * keeps a 429 under a URL that would otherwise be served from cache.
 */
export const refusalHeaders = (resetAt: Date) => ({
  "Retry-After": resetAt.toUTCString(),
  "Cache-Control": "no-store",
});
