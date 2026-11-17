import { lt } from "drizzle-orm";
import { usageDay } from "@/app/chat/usage";
import { chatDailyUsage } from "@/db/schema/chatUsage";
import {
  enochianReadingSpend,
  enochianReadings,
} from "@/db/schema/enochianReadings";
import type { ReadingSql } from "./database.ts";
import { expiredReadings } from "./store.ts";

/** What the daily job deleted, by table. */
export interface PurgeCounts {
  readings: number;
  spend: number;
  usage: number;
}

/**
 * The daily job's deletions (plan 081, S4 and S7): stored readings a day
 * old or more (each request deletes them too, so a row lives under two
 * days), the ceiling's days before today, and every daily counter row from
 * before today, chat's and the readings' clients' alike, so no client's
 * bucket outlives its day.
 */
export async function purgeReadings(
  db: ReadingSql,
  now: Date,
): Promise<PurgeCounts> {
  const { day } = usageDay(now);
  const readings = await db
    .delete(enochianReadings)
    .where(expiredReadings(now))
    .returning({ version: enochianReadings.version });
  const spend = await db
    .delete(enochianReadingSpend)
    .where(lt(enochianReadingSpend.day, day))
    .returning({ day: enochianReadingSpend.day });
  const usage = await db
    .delete(chatDailyUsage)
    .where(lt(chatDailyUsage.day, day))
    .returning({ subject: chatDailyUsage.subject });
  return {
    readings: readings.length,
    spend: spend.length,
    usage: usage.length,
  };
}
