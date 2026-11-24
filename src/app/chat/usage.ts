import { db } from "@/db/neon";
import {
  clientBucket,
  poolBucket,
  type ReservingDatabase,
  reserveDailyUsage,
  reserveTogether,
  usageDay,
  userSubject,
} from "@/limits/counters";
import { ANONYMOUS_POOL, CHAT_CLIENT, CHAT_USER } from "@/limits/policies";

/** Admission reserves a submission before provider work; failures stay counted. */
export interface ChatAdmission {
  allowed: boolean;
  resetAt: Date;
}

/**
 * Reserves one chat submission: from a signed-in reader's own allowance,
 * or from the signed-out client's bucket and the anonymous pool together
 * (`src/limits`), so one client can't use up the pool.
 */
export async function reserveDailyChatUsage(
  who: { userId: string | null; client: () => string },
  now = new Date(),
  database: ReservingDatabase = db,
): Promise<ChatAdmission> {
  const { resetAt } = usageDay(now);
  const allowed = who.userId
    ? await reserveDailyUsage(
        database,
        userSubject(who.userId),
        CHAT_USER.limit,
        1,
        now,
      )
    : (
        await reserveTogether(
          database,
          [clientBucket(CHAT_CLIENT, who.client()), poolBucket(ANONYMOUS_POOL)],
          1,
          now,
        )
      ).ok;
  return { allowed, resetAt };
}
