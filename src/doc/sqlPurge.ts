import "server-only";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  lte,
  ne,
  notExists,
  type SQL,
  sql,
} from "drizzle-orm";
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTransactionConfig,
} from "drizzle-orm/pg-core";
import { auditEvents, cronRuns } from "../db/schema/audit";
import {
  legacyFileRelocations,
  legacyFileSnapshots,
} from "../db/schema/legacyFiles";
import { loomFilesTable } from "../db/schema/loomFiles";
import {
  ritualBundleAssets,
  ritualBundlePublicationIntents,
  ritualBundles,
} from "../db/schema/ritualBundles";
import { ritualFileLinks, ritualUploadIntents } from "../db/schema/ritualFiles";
import {
  legacyRitualCompiledArchives,
  ritualCompiledArtifacts,
  ritualRevisions,
  rituals,
} from "../db/schema/rituals";
import type { RitualObjectPurger } from "../files/r2Purge";

type Transaction = Pick<
  PgDatabase<PgQueryResultHKT>,
  "select" | "insert" | "update" | "delete" | "execute"
>;
/** A transaction-capable server database, as the writers use. */
export interface SqlRitualPurgeDatabase {
  transaction<T>(
    work: (tx: Transaction) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T>;
}
type Database = SqlRitualPurgeDatabase;
type Storage = Pick<
  RitualObjectPurger,
  "bucket" | "deleteObject" | "listPrefix"
>;

/** The job's name in cron_runs. */
export const PURGE_JOB = "purge-deleted-rituals";

/** What one ritual's purge did; failures carry an error class, never a title. */
export type RitualPurgeResult =
  | { kind: "purged" }
  | { kind: "skipped" }
  /** Stopped between objects at its deadline; still claimed, it continues next night. */
  | { kind: "deferred" }
  | { kind: "failed"; error: string };

/** Counts only: the cron's response and heartbeat. */
export interface RitualPurgeCounts {
  due: number;
  purged: number;
  deferred: number;
  failed: number;
}

/** Test seams between the purge's steps. */
export interface RitualPurgeHooks {
  afterClaim?: () => Promise<void>;
}

class PurgeRefusal extends Error {}

/** A refusal that no retry within this run would change. */
const refused = (error: unknown) => {
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  return (
    value?.name === "AccessDenied" || value?.$metadata?.httpStatusCode === 403
  );
};

const errorClass = (error: unknown) =>
  error instanceof PurgeRefusal
    ? error.message
    : ((error as { name?: string } | null)?.name ?? "Error");

const READ_COMMITTED = {
  isolationLevel: "read committed",
  accessMode: "read write",
} as const;

async function lockTimeout(tx: Transaction) {
  await tx.execute(sql`select set_config('lock_timeout', '5000', true)`);
}

/** Every object the ritual owns, as recorded, and the prefixes to sweep. */
async function collectObjects(tx: Transaction, ritualId: string) {
  const assets = await tx
    .select({
      bucket: ritualBundleAssets.bucket,
      key: ritualBundleAssets.objectKey,
    })
    .from(ritualBundleAssets)
    .where(eq(ritualBundleAssets.ritualId, ritualId));
  const intents = await tx
    .select({ bundleId: ritualBundlePublicationIntents.bundleId })
    .from(ritualBundlePublicationIntents)
    .where(eq(ritualBundlePublicationIntents.ritualId, ritualId));
  const uploads = await tx
    .select({
      fileId: ritualUploadIntents.fileId,
      stagingBucket: ritualUploadIntents.stagingBucket,
      stagingKey: ritualUploadIntents.stagingObjectKey,
      canonicalBucket: ritualUploadIntents.canonicalBucket,
      canonicalKey: ritualUploadIntents.canonicalObjectKey,
    })
    .from(ritualUploadIntents)
    .where(eq(ritualUploadIntents.ritualId, ritualId));
  // Only files no other ritual or legacy record names; legacy files have no
  // ritual links, so they are never reached.
  const files = await tx
    .select({ bucket: loomFilesTable.bucket, key: loomFilesTable.objectKey })
    .from(ritualFileLinks)
    .innerJoin(loomFilesTable, eq(loomFilesTable.id, ritualFileLinks.fileId))
    .where(and(eq(ritualFileLinks.ritualId, ritualId), ...unshared(ritualId)));
  const objects = [
    ...assets,
    ...uploads.flatMap((upload) => [
      { bucket: upload.stagingBucket, key: upload.stagingKey },
      { bucket: upload.canonicalBucket, key: upload.canonicalKey },
    ]),
    ...files,
  ];
  const prefixes = [
    ...intents.map((intent) => `ritual-bundles/${intent.bundleId}/`),
    ...uploads.map((upload) => `ritual-files/${upload.fileId}/`),
  ];
  return { objects, prefixes };
}

/** A loom_files row stays when anything but this ritual's links names it. */
function unshared(ritualId: string) {
  return [
    notExists(
      sqlSelectOne(
        ritualFileLinks,
        and(
          eq(ritualFileLinks.fileId, loomFilesTable.id),
          ne(ritualFileLinks.ritualId, ritualId),
        ),
      ),
    ),
    notExists(
      sqlSelectOne(
        legacyFileSnapshots,
        eq(legacyFileSnapshots.fileId, loomFilesTable.id),
      ),
    ),
    notExists(
      sqlSelectOne(
        legacyFileRelocations,
        eq(legacyFileRelocations.fileId, loomFilesTable.id),
      ),
    ),
  ];
}

const sqlSelectOne = (
  table:
    | typeof ritualFileLinks
    | typeof legacyFileSnapshots
    | typeof legacyFileRelocations,
  where: SQL | undefined,
) => sql`(select 1 from ${table} where ${where})`;

const timestamp = (at: Date) => sql`${at.toISOString()}::timestamptz`;

/**
 * Removes one deleted ritual for good (plan 065, §5). Only the cron calls
 * it, and every step is safe to repeat:
 *
 * 1. Claim: lock the row, go on only if it is deleted and due, mark it
 *    started (restore is refused from here), collect every object it owns
 *    and refuse any recorded bucket that is null or not this deployment's.
 * 2. The point of no return, set before the first delete is sent.
 * 3. Objects, outside any transaction: each recorded key, then a
 *    best-effort sweep of the ritual's prefixes. A failed delete stops here.
 * 4. Rows, in foreign-key order, and a `purged` audit row.
 *
 * Objects go before rows: a crash between them leaves hidden rows pointing
 * at missing objects, which the rerun clears. Write receipts, legacy
 * aliases, audit rows and the import's records are kept (decisions 11, 12).
 */
export async function purgeRitual(input: {
  db: Database;
  storage: Storage;
  ritualId: string;
  now: () => Date;
  hooks?: RitualPurgeHooks;
  log?: (message: string) => void;
  /** Stop deleting objects once `clock()` reaches this; the ritual stays claimed. */
  deadline?: number;
  clock?: () => number;
}): Promise<RitualPurgeResult> {
  const { db, storage, ritualId, now } = input;
  const clock = input.clock ?? Date.now;
  const log = input.log ?? ((message: string) => console.warn(message));
  let plan: Awaited<ReturnType<typeof collectObjects>>;
  // The point of no return as this run set it, or null if it was set before.
  let ownMark: Date | null;
  try {
    const claimed = await db.transaction(async (tx) => {
      await lockTimeout(tx);
      const [row] = await tx
        .select({
          deletedAt: rituals.deletedAt,
          purgeAfter: rituals.purgeAfter,
          purgeStartedAt: rituals.purgeStartedAt,
        })
        .from(rituals)
        .where(eq(rituals.id, ritualId))
        .for("update");
      const at = now();
      // A restore that committed first wins; so does an earlier finish.
      if (!row?.deletedAt || !row.purgeAfter || row.purgeAfter > at)
        return null;
      if (!row.purgeStartedAt)
        await tx
          .update(rituals)
          .set({
            purgeStartedAt: sql`greatest(${timestamp(at)}, ${rituals.deletedAt})`,
          })
          .where(eq(rituals.id, ritualId));
      const collected = await collectObjects(tx, ritualId);
      // A preview key must never be deleted from production, or the reverse.
      const foreign = collected.objects.some(
        (object) => object.bucket !== storage.bucket,
      );
      return { collected, foreign };
    }, READ_COMMITTED);
    if (!claimed) return { kind: "skipped" };
    // The claim stays committed: the row shows "removal delayed".
    if (claimed.foreign) throw new PurgeRefusal("BucketMismatch");
    plan = claimed.collected;
    await input.hooks?.afterClaim?.();
    const marked = await db.transaction(async (tx) => {
      await lockTimeout(tx);
      const [row] = await tx
        .select({
          deletedAt: rituals.deletedAt,
          purgeStartedAt: rituals.purgeStartedAt,
          purgeObjectsDeletedAt: rituals.purgeObjectsDeletedAt,
        })
        .from(rituals)
        .where(eq(rituals.id, ritualId))
        .for("update");
      // A global administrator cancelled the removal meanwhile.
      if (!row?.deletedAt || !row.purgeStartedAt) return null;
      if (row.purgeObjectsDeletedAt) return { mark: null };
      // Set before the first delete is sent, so a crash midway never leaves
      // a cancellable ritual with objects gone. Only a refusal of this run's
      // very first delete takes it back (below).
      const at = now();
      const mark = at > row.purgeStartedAt ? at : row.purgeStartedAt;
      await tx
        .update(rituals)
        .set({ purgeObjectsDeletedAt: mark })
        .where(eq(rituals.id, ritualId));
      return { mark };
    }, READ_COMMITTED);
    if (!marked) return { kind: "skipped" };
    ownMark = marked.mark;
  } catch (error) {
    log(`purge ${ritualId}: claim failed (${errorClass(error)})`);
    return { kind: "failed", error: errorClass(error) };
  }

  const done = new Set<string>();
  try {
    class Deadline extends Error {}
    const remove = async (key: string) => {
      if (done.has(key)) return;
      if (input.deadline !== undefined && clock() >= input.deadline)
        throw new Deadline();
      await storage.deleteObject(storage.bucket, key);
      done.add(key);
    };
    try {
      for (const object of plan.objects) await remove(object.key);
      for (const prefix of plan.prefixes) {
        let found: string[];
        try {
          found = await storage.listPrefix(storage.bucket, prefix);
        } catch (error) {
          // Best-effort: the purge never needs the List permission.
          log(`purge ${ritualId}: sweep skipped (${errorClass(error)})`);
          continue;
        }
        for (const key of found) await remove(key);
      }
    } catch (error) {
      if (!(error instanceof Deadline)) throw error;
      // Deletes are idempotent: the next run starts again from the top.
      log(`purge ${ritualId}: deferred at its deadline`);
      return { kind: "deferred" };
    }
  } catch (error) {
    log(`purge ${ritualId}: object delete failed (${errorClass(error)})`);
    // A refused first delete removed nothing: take back this run's point of
    // no return, so the ritual stays cancellable (the fail-safe of §3).
    if (ownMark && done.size === 0 && refused(error))
      await db
        .transaction(async (tx) => {
          await tx
            .update(rituals)
            .set({ purgeObjectsDeletedAt: null })
            .where(
              and(
                eq(rituals.id, ritualId),
                eq(rituals.purgeObjectsDeletedAt, ownMark as Date),
              ),
            );
        }, READ_COMMITTED)
        .catch((cleared) =>
          log(`purge ${ritualId}: mark kept (${errorClass(cleared)})`),
        );
    return { kind: "failed", error: errorClass(error) };
  }

  let removed: boolean;
  try {
    removed = await db.transaction(async (tx) => {
      await lockTimeout(tx);
      const [row] = await tx
        .select({
          purgeStartedAt: rituals.purgeStartedAt,
          scope: rituals.scope,
          templeId: rituals.templeId,
          groupId: rituals.groupId,
        })
        .from(rituals)
        .where(eq(rituals.id, ritualId))
        .for("update");
      // Gone: another runner finished it, and counts it.
      if (!row) return false;
      if (!row.purgeStartedAt) throw new PurgeRefusal("NotClaimed");
      await tx
        .delete(ritualBundles)
        .where(eq(ritualBundles.ritualId, ritualId));
      await tx
        .delete(ritualBundleAssets)
        .where(eq(ritualBundleAssets.ritualId, ritualId));
      await tx
        .delete(ritualBundlePublicationIntents)
        .where(eq(ritualBundlePublicationIntents.ritualId, ritualId));
      const links = await tx
        .delete(ritualFileLinks)
        .where(eq(ritualFileLinks.ritualId, ritualId))
        .returning({ fileId: ritualFileLinks.fileId });
      if (links.length)
        await tx.delete(loomFilesTable).where(
          and(
            inArray(
              loomFilesTable.id,
              links.map((link) => link.fileId),
            ),
            ...unshared(ritualId),
          ),
        );
      await tx
        .delete(ritualUploadIntents)
        .where(eq(ritualUploadIntents.ritualId, ritualId));
      await tx
        .delete(legacyRitualCompiledArchives)
        .where(eq(legacyRitualCompiledArchives.ritualId, ritualId));
      // Break the circle of current pointers before their targets go.
      await tx
        .update(rituals)
        .set({ currentCompiledArtifactId: null, currentRevisionId: null })
        .where(eq(rituals.id, ritualId));
      await tx
        .delete(ritualCompiledArtifacts)
        .where(
          inArray(
            ritualCompiledArtifacts.revisionId,
            tx
              .select({ id: ritualRevisions.id })
              .from(ritualRevisions)
              .where(eq(ritualRevisions.ritualId, ritualId)),
          ),
        );
      await tx
        .delete(ritualRevisions)
        .where(eq(ritualRevisions.ritualId, ritualId));
      await tx.delete(rituals).where(eq(rituals.id, ritualId));
      await tx.insert(auditEvents).values({
        at: now(),
        actorId: null,
        subjectKind: "ritual",
        subjectId: ritualId,
        action: "purged",
        scope: row.scope,
        templeId: row.scope === "temple" ? row.templeId : null,
        groupId: row.scope === "group" ? row.groupId : null,
      });
      return true;
    }, READ_COMMITTED);
  } catch (error) {
    log(`purge ${ritualId}: row delete failed (${errorClass(error)})`);
    return { kind: "failed", error: errorClass(error) };
  }
  if (!removed) return { kind: "skipped" };
  log(`purge ${ritualId}: purged`);
  return { kind: "purged" };
}

/**
 * Purges the rituals that have fallen due, oldest first, at most `limit`,
 * starting no new ritual once `deadlineMs` has passed; the rest wait for the
 * next night. Storage is only built when something is due.
 */
export async function purgeDueRituals(input: {
  db: Database;
  storage: () => Storage;
  now: () => Date;
  limit: number;
  /** No new ritual starts after this many milliseconds. */
  deadlineMs: number;
  /** The running ritual stops deleting objects after this many; defaults to deadlineMs. */
  objectDeadlineMs?: number;
  hooks?: RitualPurgeHooks;
  log?: (message: string) => void;
  clock?: () => number;
}): Promise<RitualPurgeCounts> {
  const clock = input.clock ?? Date.now;
  const started = clock();
  const at = input.now();
  const { due, ids } = await input.db.transaction(
    async (tx) => {
      const condition = and(
        isNotNull(rituals.deletedAt),
        isNotNull(rituals.purgeAfter),
        lte(rituals.purgeAfter, at),
      );
      const [total] = await tx
        .select({ value: count() })
        .from(rituals)
        .where(condition);
      const rows = await tx
        .select({ id: rituals.id })
        .from(rituals)
        .where(condition)
        // Fresh due rituals first, so a stuck one never starves them; then
        // claimed ones still deleting (a large ritual continuing); last,
        // claimed ones that stopped before deleting anything (refused).
        .orderBy(
          sql`${rituals.purgeStartedAt} is not null`,
          sql`${rituals.purgeObjectsDeletedAt} is null`,
          asc(rituals.purgeAfter),
          asc(rituals.id),
        )
        .limit(input.limit);
      return { due: total?.value ?? 0, ids: rows.map((row) => row.id) };
    },
    { isolationLevel: "read committed", accessMode: "read only" },
  );
  const counts = { due, purged: 0, deferred: 0, failed: 0 };
  if (!ids.length) return counts;
  const storage = input.storage();
  let attempted = 0;
  for (const ritualId of ids) {
    if (clock() - started >= input.deadlineMs) break;
    attempted++;
    const result = await purgeRitual({
      db: input.db,
      storage,
      ritualId,
      now: input.now,
      hooks: input.hooks,
      log: input.log,
      deadline: started + (input.objectDeadlineMs ?? input.deadlineMs),
      clock,
    });
    if (result.kind === "purged") counts.purged++;
    if (result.kind === "failed") counts.failed++;
    if (result.kind === "deferred") counts.deferred++;
  }
  // Not reached this run; a skipped ritual (restored, cancelled or finished
  // by another runner meanwhile) is no longer due and counts nowhere.
  counts.deferred += due - attempted;
  return counts;
}

/** The heartbeat's outcome for a run's counts. */
export function purgeOutcome(counts: RitualPurgeCounts) {
  if (!counts.failed) return "ok" as const;
  return counts.purged ? ("partial" as const) : ("failed" as const);
}

/**
 * One nightly run with its heartbeat: cron_runs is written when the run
 * starts and again when it ends, whatever the outcome, so a run that dies
 * midway still leaves its start.
 */
export async function runRitualPurgeJob(
  input: Parameters<typeof purgeDueRituals>[0],
): Promise<RitualPurgeCounts> {
  const startedAt = input.now();
  await input.db.transaction(async (tx) => {
    await tx
      .insert(cronRuns)
      .values({ job: PURGE_JOB, startedAt })
      .onConflictDoUpdate({
        target: cronRuns.job,
        set: {
          startedAt,
          finishedAt: null,
          outcome: null,
          due: null,
          purged: null,
          deferred: null,
          failed: null,
        },
      });
  }, READ_COMMITTED);
  const finish = (values: Partial<typeof cronRuns.$inferInsert>) =>
    input.db.transaction(async (tx) => {
      await tx
        .update(cronRuns)
        .set({ finishedAt: input.now(), ...values })
        .where(
          and(eq(cronRuns.job, PURGE_JOB), eq(cronRuns.startedAt, startedAt)),
        );
    }, READ_COMMITTED);
  try {
    const counts = await purgeDueRituals(input);
    await finish({ outcome: purgeOutcome(counts), ...counts });
    return counts;
  } catch (error) {
    await finish({ outcome: "failed" }).catch(() => {});
    throw error;
  }
}

/** The last run of the nightly purge, or null if it never ran. */
export async function readPurgeHeartbeat(tx: Pick<Transaction, "select">) {
  const [row] = await tx
    .select()
    .from(cronRuns)
    .where(eq(cronRuns.job, PURGE_JOB));
  return row ?? null;
}
