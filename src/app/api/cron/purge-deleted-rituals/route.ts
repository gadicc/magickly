import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/db/neonFull";
import { runRitualPurgeJob } from "@/doc/sqlPurge";
import { createRitualObjectPurger } from "@/files/r2Purge";

export const runtime = "nodejs";
// No other route sets this. Within the minute: no ritual starts after 35
// seconds, the running one stops deleting objects at 45 (it stays claimed
// and continues the next night), and each request is capped at ten
// seconds, leaving time for its rows and the heartbeat.
export const maxDuration = 60;

/** Compares in constant time, whatever the lengths. */
function sameSecret(given: string | null, expected: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return given !== null && timingSafeEqual(digest(given), digest(expected));
}

/**
 * The nightly purge of deleted rituals (plan 065, §5), called by Vercel Cron
 * with `Authorization: Bearer $CRON_SECRET`. It never runs unconfigured. The
 * response carries counts only, never a title; logs name ritual IDs and
 * error classes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  if (!sameSecret(request.headers.get("authorization"), `Bearer ${secret}`))
    return new Response(null, { status: 401 });
  let purger: ReturnType<typeof createRitualObjectPurger> | null = null;
  try {
    const counts = await runRitualPurgeJob({
      db,
      // Built only when something is due.
      storage: () => {
        purger = createRitualObjectPurger(process.env);
        return purger;
      },
      now: () => new Date(),
      limit: 5,
      deadlineMs: 35_000,
      objectDeadlineMs: 45_000,
    });
    return Response.json(counts);
  } catch (error) {
    console.error(
      `purge-deleted-rituals: run failed (${error instanceof Error ? error.name : "Error"})`,
    );
    return Response.json({ error: "failed" }, { status: 500 });
  } finally {
    (purger as ReturnType<typeof createRitualObjectPurger> | null)?.destroy();
  }
}
