import { eq, sql } from "drizzle-orm";
import { usageDay } from "@/app/chat/usage";
import {
  enochianReadingSpend,
  enochianReadingSwitch,
} from "@/db/schema/enochianReadings";
import type { ReadingSql } from "./database.ts";

/**
 * The AI reading's daily ceiling and its switch (plan 081, S4). Each model
 * call holds its worst case against the UTC day's ceiling before it is
 * made, atomically, and settles to the gateway's reported cost after,
 * keeping the hold when none is reported, as the experiment's ledger does.
 * When a hold would pass the ceiling, readings stop for everyone until
 * midnight UTC.
 */

/** The most the readings may cost in a UTC day: $10, in millionths. */
export const DAILY_CEILING_MICRO_USD = 10_000_000;

/** The switch's one row. */
const SWITCH_ID = "readings";

/** Whether readings are turned off by hand (the switch's row). */
export async function readingsOff(db: ReadingSql): Promise<boolean> {
  const [row] = await db
    .select({ off: enochianReadingSwitch.off })
    .from(enochianReadingSwitch)
    .where(eq(enochianReadingSwitch.id, SWITCH_ID));
  return row?.off === true;
}

/**
 * Whether `microUsd` would fit under the day's ceiling now, read only: the
 * route asks before it reserves the reader's allowance, so a reader with
 * none left never takes a hold, and takes the hold itself (`holdSpend`,
 * atomic) after.
 */
export async function ceilingRoom(
  db: ReadingSql,
  microUsd: number,
  now: Date,
): Promise<{ ok: boolean; resetAt: Date }> {
  const { day, resetAt } = usageDay(now);
  const [row] = await db
    .select({ microUsd: enochianReadingSpend.microUsd })
    .from(enochianReadingSpend)
    .where(eq(enochianReadingSpend.day, day));
  return {
    ok: (row?.microUsd ?? 0) + microUsd <= DAILY_CEILING_MICRO_USD,
    resetAt,
  };
}

/** A hold on the day's spending, to settle after its call. */
export interface Hold {
  /** The UTC day it was held on, which its settling corrects. */
  day: string;
  microUsd: number;
}

/**
 * Holds `microUsd` against the day's ceiling, if it fits; else none, and
 * readings are stopped until `resetAt`.
 */
export async function holdSpend(
  db: ReadingSql,
  microUsd: number,
  now: Date,
): Promise<
  { ok: true; hold: Hold } | { ok: false; resetAt: Date; ceiling: number }
> {
  const { day, resetAt } = usageDay(now);
  const refused = {
    ok: false as const,
    resetAt,
    ceiling: DAILY_CEILING_MICRO_USD,
  };
  if (!(Number.isInteger(microUsd) && microUsd >= 0)) return refused;
  if (microUsd > DAILY_CEILING_MICRO_USD) return refused;
  const rows = await db
    .insert(enochianReadingSpend)
    .values({ day, microUsd })
    .onConflictDoUpdate({
      target: enochianReadingSpend.day,
      set: {
        microUsd: sql`${enochianReadingSpend.microUsd} + excluded.micro_usd`,
      },
      setWhere: sql`${enochianReadingSpend.microUsd} + excluded.micro_usd <= ${DAILY_CEILING_MICRO_USD}`,
    })
    .returning({ day: enochianReadingSpend.day });
  return rows.length === 1 ? { ok: true, hold: { day, microUsd } } : refused;
}

/**
 * Settles a hold to what its call cost: the gateway's reported cost, or
 * the hold itself when none was reported (so nothing is under-counted),
 * or nothing for a call never made.
 */
export async function settleSpend(
  db: ReadingSql,
  hold: Hold,
  actualMicroUsd: number | undefined,
): Promise<void> {
  const actual = actualMicroUsd ?? hold.microUsd;
  if (actual === hold.microUsd) return;
  await db
    .update(enochianReadingSpend)
    .set({
      microUsd: sql`greatest(${enochianReadingSpend.microUsd} - ${hold.microUsd} + ${actual}, 0)`,
    })
    .where(eq(enochianReadingSpend.day, hold.day));
}
