import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { enochianReadings } from "@/db/schema/enochianReadings";
import { createUuidV7 } from "@/lib/ids";
import { CHECK_VERSION, type CheckedReading } from "./check.ts";
import { DAY_MS, type ReadingSql } from "./database.ts";
import { PARTS_VERSION } from "./passage.ts";

/**
 * The AI reading's shared store (plan 081, S7). A reading is stored by its
 * prompt version and its passage as the prompt carries it, part by part as
 * each lands, so a retry after a failed second part reuses the first. An
 * identical request within a day is answered from it. A request reading a
 * passage holds a lease on its row (`claim`, `pendingUntil`), so a
 * concurrent identical request is told to wait rather than pay twice; a
 * lease left by a request that died lapses.
 *
 * Only what the card needs is kept: each part's checked rows and sentence
 * verdict (`checkReading`'s outcome) or why it failed, never the model's
 * reply.
 */

/**
 * The store's version for a prompt version (`ReadingPrompt.version`): the
 * prompt, the check (`CHECK_VERSION`) and the parts and their numbering
 * (`PARTS_VERSION`), since a stored reading depends on all three.
 */
export const readingStoreVersion = (promptVersion: string) =>
  `${promptVersion}.c${CHECK_VERSION}.p${PARTS_VERSION}`;

/** Why a part has no reading. */
export type PartFailure =
  /** The answer hit the output cap. */
  | "truncated"
  /** The answer had no readable json block. */
  | "unreadable"
  /** The gateway didn't route it as asked (OpenAI, zero retention). */
  | "routing"
  /** The provider refused the passage. */
  | "refused"
  /** The call ran past its time. */
  | "timeout"
  /** The call failed otherwise. */
  | "failed"
  /** Not sent: an earlier part was routed other than asked. */
  | "not read"
  /** Not sent: readings were turned off before it (the switch). */
  | "off";

/** A part as stored: its checked reading, why it failed, or not yet read. */
export type StoredPart =
  | { status: "read"; reading: CheckedReading }
  | { status: "failed"; state: PartFailure }
  | null;

/** A stored part that has its reading. */
export type ReadPart = Extract<StoredPart, { status: "read" }>;

const isRead = (part: StoredPart): part is ReadPart => part?.status === "read";

/** Which row: the prompt version and the passage. */
export interface StoreKey {
  version: string;
  passage: string;
}

/** What the store says of a request. */
export type StoreLookup =
  /** Read within the day: answered from the store, at no cost. */
  | { kind: "hit"; parts: readonly ReadPart[] }
  /** Being read by another request: try again shortly, at no cost. */
  | { kind: "busy" }
  /**
   * This request reads it, holding the lease `claim`: `parts` are those
   * already read (reused; none for "read again" or an old row), and `fresh`
   * says whether the reading starts anew (its day starts at its first part).
   * `replacing` is "Read again" on a complete reading, which is replaced
   * only when every part of the new one is read.
   */
  | {
      kind: "claimed";
      claim: string;
      parts: readonly StoredPart[];
      fresh: boolean;
      replacing: boolean;
    };

const keyIs = (key: StoreKey) =>
  and(
    eq(enochianReadings.version, key.version),
    eq(enochianReadings.passage, key.passage),
  );

/**
 * Which stored readings are expired: a day old or more, and not held by a
 * live lease (a request reading the rest of an old row stores under it).
 */
export const expiredReadings = (now: Date) =>
  and(
    lte(enochianReadings.createdAt, new Date(now.getTime() - DAY_MS)),
    or(
      isNull(enochianReadings.pendingUntil),
      lte(enochianReadings.pendingUntil, now),
    ),
  );

/** Deletes every expired stored reading (each request does). */
export async function deleteExpiredReadings(
  db: ReadingSql,
  now: Date,
): Promise<number> {
  const rows = await db
    .delete(enochianReadings)
    .where(expiredReadings(now))
    .returning({ version: enochianReadings.version });
  return rows.length;
}

/**
 * Looks a passage up and, unless it is a hit or busy, claims it for this
 * request with a lease of `leaseMs`. `again` ("Read again") claims even a
 * complete reading, to replace it; the old reading is served to others
 * meanwhile, and kept unless every part of the new one is read.
 */
export async function lookUpReading(
  db: ReadingSql,
  key: StoreKey,
  options: { parts: number; again: boolean; now: Date; leaseMs: number },
): Promise<StoreLookup> {
  const { parts, again, now } = options;
  const cutoff = new Date(now.getTime() - DAY_MS);
  const nothing = (): StoredPart[] => Array.from({ length: parts }, () => null);
  const read = async () =>
    (await db.select().from(enochianReadings).where(keyIs(key)))[0];
  const usable = (row: Awaited<ReturnType<typeof read>>) =>
    row !== undefined &&
    row.createdAt > cutoff &&
    Array.isArray(row.parts) &&
    row.parts.length === parts;
  const hit = (
    row: Awaited<ReturnType<typeof read>>,
  ): StoreLookup | undefined =>
    !again && usable(row) && row?.complete
      ? { kind: "hit", parts: (row.parts as StoredPart[]).filter(isRead) }
      : undefined;

  const before = await read();
  const early = hit(before);
  if (early) return early;
  if (before?.pendingUntil && before.pendingUntil > now)
    return { kind: "busy" };

  const claim = createUuidV7();
  const [claimed] = await db
    .insert(enochianReadings)
    .values({
      ...key,
      parts: nothing(),
      complete: false,
      claim,
      pendingUntil: new Date(now.getTime() + options.leaseMs),
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [enochianReadings.version, enochianReadings.passage],
      set: { claim, pendingUntil: new Date(now.getTime() + options.leaseMs) },
      // Only a row no one is reading, and one with something to read.
      setWhere: sql`(${enochianReadings.pendingUntil} is null or ${enochianReadings.pendingUntil} <= ${now.toISOString()}::timestamptz)
        and (${again}::boolean or not ${enochianReadings.complete}
          or ${enochianReadings.createdAt} <= ${cutoff.toISOString()}::timestamptz
          or jsonb_array_length(${enochianReadings.parts}) <> ${parts}::integer)`,
    })
    .returning();
  if (!claimed) return hit(await read()) ?? { kind: "busy" };
  const reused =
    !again && usable(claimed)
      ? (claimed.parts as StoredPart[]).map((one) => (isRead(one) ? one : null))
      : nothing();
  return {
    kind: "claimed",
    claim,
    parts: reused,
    fresh: !reused.some(isRead),
    replacing: again && usable(claimed) && claimed.complete,
  };
}

/**
 * Stores the parts as they stand, under this request's lease: called as
 * each part is read, so a later request reuses it even if this one dies.
 * A fresh reading's day starts with its first part.
 */
export async function storeParts(
  db: ReadingSql,
  key: StoreKey,
  claim: string,
  parts: readonly StoredPart[],
  options: { fresh: boolean; now: Date },
): Promise<void> {
  await db
    .update(enochianReadings)
    .set({
      parts: [...parts],
      complete: parts.every(isRead),
      ...(options.fresh ? { createdAt: options.now } : {}),
    })
    .where(and(keyIs(key), eq(enochianReadings.claim, claim)));
}

/**
 * Ends this request's lease. A row with no part read (a new passage whose
 * every call failed, or a request refused after its claim) is deleted, so
 * the store holds no passage without its reading; a "Read again" that read
 * nothing keeps the reading it would have replaced.
 */
export async function releaseReading(
  db: ReadingSql,
  key: StoreKey,
  claim: string,
): Promise<void> {
  const mine = and(keyIs(key), eq(enochianReadings.claim, claim));
  await db
    .delete(enochianReadings)
    .where(
      and(
        mine,
        sql`not (${enochianReadings.parts} @> '[{"status":"read"}]'::jsonb)`,
      ),
    );
  await db
    .update(enochianReadings)
    .set({ claim: null, pendingUntil: null })
    .where(mine);
}
