import { db } from "@/db/neon";
import {
  clientBucket,
  poolBucket,
  type ReservingDatabase,
  reserveTogether,
  usageDay,
} from "@/limits/counters";
import { SEARCH_CLIENT, SEARCH_POOL } from "@/limits/policies";

/**
 * Reserves one search by meaning before its embedding call, from the
 * client's bucket (`client`, from `requestClientSubject` under
 * `SEARCH_CLIENT`) and the site's daily pool together (`src/limits`).
 * Text search uses no hosted capacity and is never counted. A cancelled or
 * failed search stays counted: it may already have cost.
 */
export async function reserveSearchUsage(
  client: string,
  now = new Date(),
  database: ReservingDatabase = db,
) {
  const reserved = await reserveTogether(
    database,
    [clientBucket(SEARCH_CLIENT, client), poolBucket(SEARCH_POOL)],
    1,
    now,
  );
  return { allowed: reserved.ok, resetAt: usageDay(now).resetAt };
}
