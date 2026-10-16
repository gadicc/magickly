import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/neon";
import { chatDailyUsage } from "@/db/schema/chatUsage";

export const USER_DAILY_CHAT_LIMIT = 100;
export const ANONYMOUS_DAILY_CHAT_LIMIT = 500;

/** Admission reserves a submission before provider work; failures stay counted. */
export interface ChatAdmission {
  allowed: boolean;
  resetAt: Date;
}

/** Atomically reserve capacity across instances and both chat protocols. */
export async function reserveDailyChatUsage(
  userId: string | null,
  now = new Date(),
): Promise<ChatAdmission> {
  const day = now.toISOString().slice(0, 10);
  const resetAt = new Date(`${day}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  const limit = userId ? USER_DAILY_CHAT_LIMIT : ANONYMOUS_DAILY_CHAT_LIMIT;
  const rows = await db
    .insert(chatDailyUsage)
    .values({
      subject: userId ? `user:${userId}` : "anonymous",
      day,
      submissions: 1,
    })
    .onConflictDoUpdate({
      target: chatDailyUsage.subject,
      set: {
        day,
        submissions: sql`case when ${chatDailyUsage.day} = ${day}::date then ${chatDailyUsage.submissions} + 1 else 1 end`,
      },
      // A stale request from before midnight must not reset a newer day's row.
      setWhere: or(
        lt(chatDailyUsage.day, day),
        and(eq(chatDailyUsage.day, day), lt(chatDailyUsage.submissions, limit)),
      ),
    })
    .returning({ subject: chatDailyUsage.subject });
  return { allowed: rows.length === 1, resetAt };
}
