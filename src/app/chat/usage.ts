import { and, eq, lt, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { db } from "@/db/neon";
import { chatDailyUsage } from "@/db/schema/chatUsage";

export const USER_DAILY_CHAT_LIMIT = 100;
export const ANONYMOUS_DAILY_CHAT_LIMIT = 500;

/** Admission reserves a submission before provider work; failures stay counted. */
export interface ChatAdmission {
  allowed: boolean;
  resetAt: Date;
}

/** Where a reservation runs: the database, or a transaction on it. */
export type UsageDatabase = Pick<
  PgDatabase<PgQueryResultHKT>,
  "insert" | "select"
>;

/** A UTC day ("2026-10-16") and the midnight that ends it. */
export function usageDay(now: Date) {
  const day = now.toISOString().slice(0, 10);
  const resetAt = new Date(`${day}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { day, resetAt };
}

/** The counter's subject for a reader: their user, or the anonymous pool. */
export const usageSubject = (userId: string | null) =>
  userId ? `user:${userId}` : "anonymous";

/**
 * Atomically adds `units` to a subject's counter for the day `now` falls
 * in, if that keeps it within `limit`; returns whether it did. Chat
 * reserves one a submission; an AI reading of Enochian reserves its units
 * (plan 081, S4) from the same counters.
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

/** Atomically reserve capacity across instances and both chat protocols. */
export async function reserveDailyChatUsage(
  userId: string | null,
  now = new Date(),
): Promise<ChatAdmission> {
  const limit = userId ? USER_DAILY_CHAT_LIMIT : ANONYMOUS_DAILY_CHAT_LIMIT;
  const allowed = await reserveDailyUsage(
    db,
    usageSubject(userId),
    limit,
    1,
    now,
  );
  return { allowed, resetAt: usageDay(now).resetAt };
}
