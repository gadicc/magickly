import { and, eq, lt, or, type SQL, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import type { ClientPolicy, PoolPolicy } from "./policies.ts";

/**
 * The daily counters every policy in `policies.ts` is kept in: one row a
 * subject in `chat_daily_usage`, for the UTC day it was last reserved on.
 * A reservation is atomic, so concurrent requests on any instance can't
 * overshoot a limit; `reserveTogether` takes several counters or none, in
 * one statement.
 */

/** Where a reservation runs: the database, or a transaction on it. */
export type UsageDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "insert" | "select"
>;

/**
 * A database `reserveTogether` can run its one statement on: either
 * client, `@/db/neon`'s HTTP one (preferred: no connection held) or
 * `@/db/neonFull`'s, but never a transaction, which its refusal would
 * abort.
 */
export interface ReservingDatabase extends UsageDatabase {
  execute(query: SQL): PromiseLike<unknown>;
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

/** Taken from every bucket, or refused by the first that was full. */
export type Reservation = { ok: true } | { ok: false; refused: Bucket };

/** Postgres's `division_by_zero`, which a refused reservation raises. */
const REFUSED = "22012";

function isRefusal(error: unknown): boolean {
  for (let at = error; at instanceof Error; at = at.cause)
    if ((at as { code?: unknown }).code === REFUSED) return true;
  return false;
}

/**
 * Reserves `units` from every bucket, so all are counted or none is, in a
 * single statement: one guarded upsert a bucket (as `reserveDailyUsage`'s),
 * each run only when the one before it took its units, then a division by
 * the last one's count, which fails the statement, and so undoes every
 * upsert in it, when any bucket was full. One statement needs no
 * transaction, so it runs over the HTTP driver in one round trip.
 *
 * Put the narrowest bucket first (the client's): a client over its own
 * limit never touches a shared pool's row, and every caller locks rows in
 * the same order. Which bucket refused is read afterwards, so under a race
 * it is the best guess, not a guarantee.
 */
export async function reserveTogether(
  db: ReservingDatabase,
  buckets: readonly Bucket[],
  units: number,
  now: Date,
): Promise<Reservation> {
  if (buckets.length === 0) return { ok: true };
  const tooMany = buckets.find(
    (one) => !(Number.isInteger(units) && units > 0 && units <= one.limit),
  );
  if (tooMany) return { ok: false, refused: tooMany };
  const { day } = usageDay(now);
  const t = chatDailyUsage;
  const steps = buckets.map((one, at) => {
    const row = sql`${one.subject}::text, ${day}::date, ${units}::int`;
    const source =
      at === 0
        ? sql`values (${row})`
        : sql`select ${row} where exists (select from ${sql.raw(`taken${at - 1}`)})`;
    return sql`${sql.raw(`taken${at}`)} as (
      insert into ${t} (subject, day, submissions) ${source}
      on conflict (subject) do update set
        day = excluded.day,
        submissions = case when ${t.day} = ${day}::date
          then ${t.submissions} + ${units}::int else ${units}::int end
      where ${t.day} < ${day}::date
        or (${t.day} = ${day}::date
          and ${t.submissions} + ${units}::int <= ${one.limit}::int)
      returning 1)`;
  });
  const last = sql.raw(`taken${buckets.length - 1}`);
  try {
    await db.execute(
      sql`with ${sql.join(steps, sql`, `)} select 1 / (select count(*)::int from ${last})`,
    );
    return { ok: true };
  } catch (error) {
    if (!isRefusal(error)) throw error;
  }
  for (const one of buckets)
    if ((await dailyUsageLeft(db, one.subject, one.limit, now)) < units)
      return { ok: false, refused: one };
  return { ok: false, refused: buckets[buckets.length - 1] };
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
