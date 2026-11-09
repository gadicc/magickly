import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/neon";
import { siteSearchUsage } from "@/db/schema/searchUsage";

// Shared across visitors/instances; text search consumes no hosted capacity.
export const DAILY_SEMANTIC_SEARCH_LIMIT = 10_000;

/** Reserves before provider work; cancellation/failure may already incur usage. */
export async function reserveSearchUsage(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const resetAt = new Date(`${day}T00:00:00Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  const rows = await db
    .insert(siteSearchUsage)
    .values({ id: "global", day, queries: 1 })
    .onConflictDoUpdate({
      target: siteSearchUsage.id,
      set: {
        day,
        queries: sql`case when ${siteSearchUsage.day} = ${day}::date then ${siteSearchUsage.queries} + 1 else 1 end`,
      },
      setWhere: or(
        lt(siteSearchUsage.day, day),
        and(
          eq(siteSearchUsage.day, day),
          lt(siteSearchUsage.queries, DAILY_SEMANTIC_SEARCH_LIMIT),
        ),
      ),
    })
    .returning({ id: siteSearchUsage.id });
  return { allowed: rows.length === 1, resetAt };
}
