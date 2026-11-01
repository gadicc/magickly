// The purge against the full schema, its real foreign keys and a fake object
// store. PGlite is one session, so concurrency is covered by query-log
// assertions for the locks and by interleavings driven through the storage
// fake and the afterClaim hook, run in sequence (plan 065, "Tests and checks").
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  BUNDLE_FIXTURE_POLICY,
  BUNDLE_FIXTURE_TIME,
  clearRitualBundleFixture,
  type RitualBundleFixture,
  ritualBundleFixtureRecords,
  seedRitualBundleFixture,
} from "../../tests/ritualBundleFixtures";
import * as schema from "../db/schema/index";
import { createSqlRitualUploads } from "../files/sqlRitualUploads";
import { createUuidV7 } from "../lib/ids";
import { bundleTextSha256 as hash } from "../offline/ritualBundlePublication";
import { createSqlRitualBundlePublisher } from "../offline/sqlRitualBundlePublications";
import { RETENTION_MS } from "./ritualRetention";
import { createSqlRitualLifecycleService } from "./sqlLifecycle";
import {
  PURGE_JOB,
  purgeDueRituals,
  purgeOutcome,
  purgeRitual,
  type RitualPurgeHooks,
  readPurgeHeartbeat,
  runRitualPurgeJob,
  type SqlRitualPurgeDatabase,
} from "./sqlPurge";
import { createSqlRitualWriter } from "./sqlWrites";

vi.mock("server-only", () => ({}));

const {
  auditEvents,
  cronRuns,
  legacyFileRelocations,
  legacyFileSnapshots,
  legacyIdAliases,
  legacyImportRuns,
  legacyRitualCompiledArchives,
  loomFilesTable,
  ritualBundleAssets,
  ritualBundlePublicationIntents,
  ritualBundles,
  ritualCompiledArtifacts,
  ritualFileLinks,
  ritualRevisions,
  ritualUploadIntents,
  ritualWriteReceipts,
  rituals,
} = schema;
const harness = await createMemoryPgliteHarness({ schema });
const queries: string[] = [];
const db = drizzle(harness.client, {
  schema,
  logger: { logQuery: (query) => queries.push(query) },
});
afterAll(() => harness.client.close());

const BUCKET = "synthetic-private";
const LEGACY_BUCKET = "legacy-bucket";
/** Deleted a day after the fixture's bundle; due 30 days later. */
const DELETED = new Date(BUNDLE_FIXTURE_TIME + 86_400_000);
const DUE = new Date(DELETED.getTime() + RETENTION_MS + 3_600_000);
const hex = (value: string) => hash(value);

let fixture: RitualBundleFixture;
let ritualId: string;
let other: { ritualId: string; revisionId: string; fileId: string };
let world: Awaited<ReturnType<typeof populate>>;
let logs: string[];
const log = (message: string) => logs.push(message);

const lifecycle = (actor: string, at = DUE) =>
  createSqlRitualLifecycleService(db, async () => actor, { now: () => at });
const command = (actor: string, id = ritualId) => ({
  version: 1,
  expectedActorId: actor,
  ritualId: id,
});
const ritualRow = async (id = ritualId) => {
  const [row] = await db.select().from(rituals).where(eq(rituals.id, id));
  return row;
};

/** An upload intent and its link; the loom_files row unless one exists. */
async function addUpload(
  owner: string,
  options: { fileId?: string; file?: boolean; bucket?: string | null } = {},
) {
  const operationId = createUuidV7(),
    attachmentId = createUuidV7(),
    fileId = options.fileId ?? createUuidV7();
  const sha256 = hex(`bytes of ${fileId}`);
  const staging = `staging/${operationId}`;
  const canonical = `ritual-files/${fileId}/${sha256}`;
  const at = new Date(BUNDLE_FIXTURE_TIME);
  await db.insert(ritualUploadIntents).values({
    operationId,
    actorId: fixture.actors.creator,
    ritualId: owner,
    requestHash: hex(`request ${operationId}`),
    filename: "synthetic.png",
    byteSize: 3,
    contentType: "image/png",
    sha256,
    fileId,
    attachmentId,
    stagingProvider: "r2-private",
    stagingBucket: BUCKET,
    stagingObjectKey: staging,
    canonicalProvider: "r2-private",
    canonicalBucket: BUCKET,
    canonicalObjectKey: canonical,
    createdAt: at,
    expiresAt: new Date(at.getTime() + 3_600_000),
  });
  if (options.file !== false)
    await db.insert(loomFilesTable).values({
      id: fileId,
      sha256,
      byteSize: 3,
      originalFilename: "synthetic.png",
      contentType: "image/png",
      detectedContentType: "image/png",
      kind: "image",
      storageProvider: "r2-private",
      bucket: options.bucket === undefined ? BUCKET : options.bucket,
      objectKey: canonical,
      ownerType: "user",
      ownerId: fixture.actors.creator,
    });
  await db.insert(ritualFileLinks).values({
    id: attachmentId,
    operationId,
    ritualId: owner,
    fileId,
    uploaderId: fixture.actors.creator,
    createdAt: at,
  });
  return { fileId, staging, canonical };
}

/**
 * A fully populated deleted ritual (current revision and artifact pointers, a
 * legacy archive, a published bundle with assets, an upload with its file, and
 * an upload linking a legacy file), plus what must survive its purge.
 */
async function populate() {
  const records = ritualBundleFixtureRecords(fixture, { completed: true });
  await db.insert(ritualBundlePublicationIntents).values(records.intent);
  await db.insert(ritualBundleAssets).values(records.rows);
  if (!records.marker) throw new Error("Expected a completed bundle");
  await db.insert(ritualBundles).values(records.marker);
  const archived = JSON.stringify({ children: [] });
  await db.insert(legacyRitualCompiledArchives).values({
    ritualId,
    claimedRevisionId: fixture.revision.id,
    contentJson: archived,
    contentSha256: hex(archived),
    serializationVersion: "json-stringify-utf8-v1",
    importedAt: new Date(BUNDLE_FIXTURE_TIME),
  });
  const upload = await addUpload(ritualId);

  // A legacy file, named by a relocation, that this ritual links to.
  const legacyFileId = createUuidV7();
  const legacySha = hex("legacy bytes");
  const legacyKey = `legacy-file2/${legacySha}`;
  await db.insert(loomFilesTable).values({
    id: legacyFileId,
    sha256: legacySha,
    byteSize: 3,
    kind: "image",
    storageProvider: "r2",
    bucket: LEGACY_BUCKET,
    objectKey: legacyKey,
    visibility: "public",
  });
  await db.insert(legacyFileRelocations).values({
    fileId: legacyFileId,
    sourceStorageProvider: "r2",
    sourceBucket: LEGACY_BUCKET,
    sourceObjectKey: `${LEGACY_BUCKET}/${legacySha}`,
    sourceMetadataSha256: hex("legacy metadata"),
    contentSha256: legacySha,
    byteSize: 3,
    destinationStorageProvider: "r2",
    destinationBucket: "magickli-files-production",
    destinationObjectKey: legacyKey,
    verificationProfile: "magickli-legacy-file-relocation-v1",
    verifiedAt: new Date(BUNDLE_FIXTURE_TIME),
  });
  const legacyUpload = await addUpload(ritualId, {
    fileId: legacyFileId,
    file: false,
  });

  // Kept by decisions 11 and 12.
  await db.insert(ritualWriteReceipts).values({
    operationId: createUuidV7(),
    actorId: fixture.actors.creator,
    requestHash: hex("receipt"),
    kind: "save",
    ritualId,
    revisionId: fixture.revision.id,
    version: 7,
    updatedAt: new Date(BUNDLE_FIXTURE_TIME),
  });
  await db.insert(legacyIdAliases).values({
    id: createUuidV7(),
    sourceSystem: "mongodb",
    entityType: "ritual",
    legacyIdType: "objectid",
    legacyIdValue: "0123456789abcdef01234567",
    canonicalId: ritualId,
  });
  const payload = JSON.stringify({ synthetic: true, ritualId });
  await db.insert(legacyImportRuns).values({
    runId: createUuidV7(),
    slot: 1,
    profile: "magickli-legacy-import-run-v1",
    sourceManifestSha256: hex("manifest"),
    sourceDescriptorSha256: hex("descriptor"),
    configurationSha256: hex("configuration"),
    schemaSha256: hex("schema"),
    targetSha256: hex("target"),
    payloadSha256: hex(payload),
    expectedRowsSha256: hex("rows"),
    payload,
    importedAt: new Date(BUNDLE_FIXTURE_TIME),
    preparedAt: new Date(BUNDLE_FIXTURE_TIME),
  });

  // A second deleted, due ritual with its own revision and upload.
  const otherId = createUuidV7();
  await db.insert(rituals).values({
    id: otherId,
    title: "Second synthetic ritual",
    creatorId: fixture.actors.creator,
    scope: "group",
    groupId: fixture.groupId,
  });
  const source = "p Second synthetic source";
  const [revision] = await db
    .insert(ritualRevisions)
    .values({
      id: createUuidV7(),
      ritualId: otherId,
      authorId: fixture.actors.creator,
      source,
      sourceSha256: hex(source),
      sourceFormat: "pug",
      sourceFormatVersion: "1",
      createdAt: new Date(BUNDLE_FIXTURE_TIME),
      updatedAt: new Date(BUNDLE_FIXTURE_TIME),
    })
    .returning();
  await db
    .update(rituals)
    .set({ currentRevisionId: revision.id })
    .where(eq(rituals.id, otherId));
  const otherUpload = await addUpload(otherId);
  other = {
    ritualId: otherId,
    revisionId: revision.id,
    fileId: otherUpload.fileId,
  };

  for (const id of [ritualId, otherId])
    expect(
      await lifecycle(fixture.actors.creator, DELETED).deleteRitual(
        command(fixture.actors.creator, id),
      ),
    ).toEqual({ ok: true, ritualId: id });

  const assetKeys = records.rows.map((row) => row.objectKey);
  const orphans = [
    `ritual-bundles/${records.intent.bundleId}/orphan`,
    `ritual-files/${upload.fileId}/orphan`,
  ];
  return {
    records,
    upload,
    legacyUpload,
    legacyFileId,
    legacyKey,
    otherUpload,
    assetKeys,
    orphans,
    /** Every key this ritual's purge must delete. */
    owned: [
      ...assetKeys,
      upload.staging,
      upload.canonical,
      legacyUpload.staging,
      legacyUpload.canonical,
      ...orphans,
    ],
    /** Keys in the store that are not this ritual's. */
    foreign: [
      legacyKey,
      otherUpload.staging,
      otherUpload.canonical,
      // Not under any of this ritual's prefixes.
      `ritual-files/${otherUpload.fileId}/orphan`,
    ],
  };
}

/** Every row the purge could touch, in a stable order. */
async function everything() {
  const sorted = <T>(rows: T[]) =>
    rows
      .map((row) => JSON.stringify(row))
      .sort()
      .map((row) => JSON.parse(row));
  return {
    rituals: sorted(await db.select().from(rituals)),
    revisions: sorted(await db.select().from(ritualRevisions)),
    artifacts: sorted(await db.select().from(ritualCompiledArtifacts)),
    archives: sorted(await db.select().from(legacyRitualCompiledArchives)),
    intents: sorted(await db.select().from(ritualBundlePublicationIntents)),
    assets: sorted(await db.select().from(ritualBundleAssets)),
    bundles: sorted(await db.select().from(ritualBundles)),
    uploads: sorted(await db.select().from(ritualUploadIntents)),
    links: sorted(await db.select().from(ritualFileLinks)),
    files: sorted(await db.select().from(loomFilesTable)),
    relocations: sorted(await db.select().from(legacyFileRelocations)),
    snapshots: sorted(await db.select().from(legacyFileSnapshots)),
    receipts: sorted(await db.select().from(ritualWriteReceipts)),
    aliases: sorted(await db.select().from(legacyIdAliases)),
    imports: sorted(await db.select().from(legacyImportRuns)),
    audit: sorted(await db.select().from(auditEvents)),
  };
}

/** What each §5 table holds for one ritual. */
async function heldFor(id: string, revisionIds: string[], fileIds: string[]) {
  const n = async (rows: Promise<unknown[]>) => (await rows).length;
  return {
    ritual_bundles: await n(
      db.select().from(ritualBundles).where(eq(ritualBundles.ritualId, id)),
    ),
    ritual_bundle_assets: await n(
      db
        .select()
        .from(ritualBundleAssets)
        .where(eq(ritualBundleAssets.ritualId, id)),
    ),
    ritual_bundle_publication_intents: await n(
      db
        .select()
        .from(ritualBundlePublicationIntents)
        .where(eq(ritualBundlePublicationIntents.ritualId, id)),
    ),
    ritual_file_links: await n(
      db.select().from(ritualFileLinks).where(eq(ritualFileLinks.ritualId, id)),
    ),
    loom_files: await n(
      db
        .select()
        .from(loomFilesTable)
        .where(inArray(loomFilesTable.id, fileIds)),
    ),
    ritual_upload_intents: await n(
      db
        .select()
        .from(ritualUploadIntents)
        .where(eq(ritualUploadIntents.ritualId, id)),
    ),
    legacy_ritual_compiled_archives: await n(
      db
        .select()
        .from(legacyRitualCompiledArchives)
        .where(eq(legacyRitualCompiledArchives.ritualId, id)),
    ),
    ritual_compiled_artifacts: await n(
      db
        .select()
        .from(ritualCompiledArtifacts)
        .where(inArray(ritualCompiledArtifacts.revisionId, revisionIds)),
    ),
    ritual_revisions: await n(
      db.select().from(ritualRevisions).where(eq(ritualRevisions.ritualId, id)),
    ),
    rituals: await n(db.select().from(rituals).where(eq(rituals.id, id))),
  };
}
const NOTHING = {
  ritual_bundles: 0,
  ritual_bundle_assets: 0,
  ritual_bundle_publication_intents: 0,
  ritual_file_links: 0,
  loom_files: 0,
  ritual_upload_intents: 0,
  legacy_ritual_compiled_archives: 0,
  ritual_compiled_artifacts: 0,
  ritual_revisions: 0,
  rituals: 0,
};
const heldForPurged = () =>
  heldFor(ritualId, [fixture.revision.id], [world.upload.fileId]);

class StorageDown extends Error {
  override name = "StorageDown";
}
class ListDenied extends Error {
  override name = "AccessDenied";
}
/** S3's refusal as the SDK reports it: no AccessDenied name, but a 403. */
class Forbidden extends Error {
  override name = "Forbidden";
  $metadata = { httpStatusCode: 403 };
}

/** An in-memory bucket. A missing object deletes as success. */
function fakeStorage(
  options: {
    bucket?: string;
    keys?: string[];
    onDelete?: (key: string, call: number) => Promise<void> | void;
    list?: (prefix: string) => Promise<string[]> | string[];
  } = {},
) {
  const bucket = options.bucket ?? BUCKET;
  const store = new Set(options.keys ?? [...world.owned, ...world.foreign]);
  const deleted: string[] = [];
  const storage = {
    bucket,
    store,
    deleted,
    deleteObject: vi.fn(async (target: string, key: string) => {
      expect(target).toBe(bucket);
      await options.onDelete?.(key, deleted.length + 1);
      deleted.push(key);
      store.delete(key);
    }),
    listPrefix: vi.fn(async (target: string, prefix: string) => {
      expect(target).toBe(bucket);
      if (options.list) return options.list(prefix);
      return [...store].filter((key) => key.startsWith(prefix));
    }),
  };
  return storage;
}

const purge = (
  storage: ReturnType<typeof fakeStorage>,
  hooks?: RitualPurgeHooks,
  at = DUE,
  id = ritualId,
) => purgeRitual({ db, storage, ritualId: id, now: () => at, hooks, log });

async function clearAll() {
  await db.delete(cronRuns);
  await db.delete(auditEvents);
  await db.delete(ritualWriteReceipts);
  await db.delete(legacyIdAliases);
  await db.delete(legacyImportRuns);
  await db.delete(ritualBundles);
  await db.delete(ritualBundleAssets);
  await db.delete(ritualBundlePublicationIntents);
  await db.delete(ritualFileLinks);
  await db.delete(ritualUploadIntents);
  await db.delete(legacyFileRelocations);
  await db.delete(legacyFileSnapshots);
  await db.delete(loomFilesTable);
  await clearRitualBundleFixture(db);
}

beforeEach(async () => {
  vi.restoreAllMocks();
  logs = [];
  await clearAll();
  fixture = await seedRitualBundleFixture(db);
  ritualId = fixture.parent.id;
  world = await populate();
  queries.length = 0;
});
afterEach(() => fixture.dispose());

describe("purging one ritual", () => {
  it("removes every row and object it owns and keeps everything else", async () => {
    const before = await everything();
    expect(await heldForPurged()).toEqual({
      ritual_bundles: 1,
      ritual_bundle_assets: world.assetKeys.length,
      ritual_bundle_publication_intents: 1,
      ritual_file_links: 2,
      loom_files: 1,
      ritual_upload_intents: 2,
      legacy_ritual_compiled_archives: 1,
      ritual_compiled_artifacts: 1,
      ritual_revisions: 1,
      rituals: 1,
    });
    expect(world.assetKeys.length).toBeGreaterThan(0);
    const ritual = await ritualRow();
    expect(ritual.currentRevisionId).toBe(fixture.revision.id);
    expect(ritual.currentCompiledArtifactId).toBe(fixture.artifact.id);

    const storage = fakeStorage();
    expect(await purge(storage)).toEqual({ kind: "purged" });

    // Rows: the order held under the real foreign keys.
    expect(await heldForPurged()).toEqual(NOTHING);
    const after = await everything();
    const not = <T extends Record<string, unknown>>(
      rows: T[],
      key: keyof T,
      value: unknown,
    ) => rows.filter((row) => row[key] !== value);
    expect(after.rituals).toEqual(not(before.rituals, "id", ritualId));
    expect(after.revisions).toEqual(
      not(before.revisions, "ritualId", ritualId),
    );
    expect(after.uploads).toEqual(not(before.uploads, "ritualId", ritualId));
    expect(after.links).toEqual(not(before.links, "ritualId", ritualId));
    expect(after.files).toEqual(not(before.files, "id", world.upload.fileId));
    // The second ritual keeps its rows, file and current revision.
    expect(
      await heldFor(other.ritualId, [other.revisionId], [other.fileId]),
    ).toMatchObject({
      ritual_file_links: 1,
      loom_files: 1,
      ritual_upload_intents: 1,
      ritual_revisions: 1,
      rituals: 1,
    });
    expect((await ritualRow(other.ritualId)).currentRevisionId).toBe(
      other.revisionId,
    );
    // The legacy file the ritual linked to stays, with its relocation.
    expect(
      after.files.filter((file) => file.id === world.legacyFileId),
    ).toHaveLength(1);
    expect(after.relocations).toEqual(before.relocations);
    expect(after.relocations).toHaveLength(1);
    // Receipts, aliases and the import run are kept.
    expect(after.receipts).toEqual(before.receipts);
    expect(after.receipts).toHaveLength(1);
    expect(after.aliases).toEqual(before.aliases);
    expect(after.aliases).toHaveLength(1);
    expect(after.imports).toEqual(before.imports);
    expect(after.imports).toHaveLength(1);

    // The audit row: no actor, the scope snapshot, no title.
    const purged = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.action, "purged"));
    expect(purged).toEqual([
      {
        id: expect.any(String),
        at: DUE,
        actorId: null,
        subjectKind: "ritual",
        subjectId: ritualId,
        action: "purged",
        scope: "temple",
        templeId: fixture.templeId,
        groupId: null,
      },
    ]);
    // Earlier audit rows are kept.
    expect(after.audit).toEqual(expect.arrayContaining(before.audit));

    // Objects: every recorded key, each once, then the sweep's orphans; all
    // in the configured bucket. Nothing else.
    expect([...storage.deleted].sort()).toEqual([...world.owned].sort());
    expect(storage.deleted.slice(-world.orphans.length).sort()).toEqual(
      [...world.orphans].sort(),
    );
    for (const call of storage.deleteObject.mock.calls)
      expect(call[0]).toBe(BUCKET);
    expect([...storage.store].sort()).toEqual([...world.foreign].sort());
    expect(storage.listPrefix.mock.calls.map((call) => call[1])).toEqual([
      `ritual-bundles/${world.records.intent.bundleId}/`,
      `ritual-files/${world.upload.fileId}/`,
      `ritual-files/${world.legacyFileId}/`,
    ]);
    expect(logs).toEqual([`purge ${ritualId}: purged`]);
  });

  it("runs the claim and the row delete under row locks with lock_timeout", async () => {
    await purge(fakeStorage());
    const starts = queries.flatMap((query, index) =>
      /set transaction isolation level read committed read write/.test(query)
        ? [index]
        : [],
    );
    // The claim, the point of no return, the rows.
    expect(starts).toHaveLength(3);
    const transaction = (n: number) =>
      queries.slice(starts[n], starts[n + 1] ?? queries.length);
    for (const n of [0, 1, 2])
      expect(transaction(n)[1]).toContain("lock_timeout");
    for (const [n, first] of [
      [0, /^update "rituals" set "purge_started_at"/],
      [1, /^update "rituals" set "purge_objects_deleted_at"/],
      [2, /^delete from "ritual_bundles"/],
    ] as const) {
      const steps = transaction(n);
      const lock = steps.findIndex(
        (query) =>
          query.includes('from "rituals"') && query.endsWith("for update"),
      );
      expect(lock).toBe(2);
      expect(steps[lock]).toMatch(/where "rituals"."id" = \$1 for update$/);
      expect(steps.findIndex((query) => first.test(query))).toBeGreaterThan(
        lock,
      );
    }
    // The point of no return reads the row it locked, then sets the mark.
    expect(transaction(1)[3]).toMatch(
      /^update "rituals" set "purge_objects_deleted_at"/,
    );
  });

  it("sets the point of no return before the first delete is sent", async () => {
    const seen: (Date | null)[] = [];
    const storage = fakeStorage({
      onDelete: async (_key, call) => {
        if (call > 1) return;
        const row = await ritualRow();
        seen.push(row.purgeStartedAt, row.purgeObjectsDeletedAt);
      },
    });
    expect(await purge(storage)).toEqual({ kind: "purged" });
    expect(seen).toEqual([DUE, DUE]);
  });

  it("logs a sweep's list failure by class, never the title, and goes on", async () => {
    const storage = fakeStorage({
      list: (prefix) => {
        if (prefix.startsWith("ritual-bundles/"))
          throw new ListDenied(fixture.parent.title);
        return [`${prefix}orphan`];
      },
    });
    expect(await purge(storage)).toEqual({ kind: "purged" });
    expect(logs).toEqual([
      `purge ${ritualId}: sweep skipped (AccessDenied)`,
      `purge ${ritualId}: purged`,
    ]);
    for (const message of logs) expect(message).not.toContain("Synthetic");
    // The bundle prefix's orphan stays; the upload prefixes were swept.
    expect(storage.store).toContain(world.orphans[0]);
    expect(storage.deleted).toContain(world.orphans[1]);
    expect(storage.deleted).toContain(
      `ritual-files/${world.legacyFileId}/orphan`,
    );
    expect(await heldForPurged()).toEqual(NOTHING);
  });

  it("warns through the console when no log is given", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await purgeRitual({
      db,
      storage: fakeStorage(),
      ritualId,
      now: () => DUE,
    });
    expect(warn).toHaveBeenCalledWith(`purge ${ritualId}: purged`);
  });
});

describe("refusals", () => {
  async function expectRefused(storage: ReturnType<typeof fakeStorage>) {
    const before = await everything();
    expect(await purge(storage)).toEqual({
      kind: "failed",
      error: "BucketMismatch",
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(storage.listPrefix).not.toHaveBeenCalled();
    const row = await ritualRow();
    // Left claimed: the row shows "removal delayed".
    expect(row.purgeStartedAt).toEqual(DUE);
    expect(row.purgeObjectsDeletedAt).toBeNull();
    const after = await everything();
    expect({ ...after, rituals: [] }).toEqual({ ...before, rituals: [] });
    expect(after.rituals).toHaveLength(before.rituals.length);
    expect(logs).toEqual([`purge ${ritualId}: claim failed (BucketMismatch)`]);
  }

  it("refuses a loom_files row with a null bucket", async () => {
    await db
      .update(loomFilesTable)
      .set({ bucket: null })
      .where(eq(loomFilesTable.id, world.upload.fileId));
    await expectRefused(fakeStorage());
  });

  it("refuses a recorded bucket that is not this deployment's", async () => {
    await expectRefused(fakeStorage({ bucket: "magickli-preview" }));
  });

  it("refuses one foreign upload bucket among matching ones", async () => {
    await db
      .update(ritualUploadIntents)
      .set({ stagingBucket: "magickli-preview" })
      .where(eq(ritualUploadIntents.fileId, world.upload.fileId));
    await expectRefused(fakeStorage());
  });
});

describe("skips", () => {
  async function expectSkipped(id = ritualId, at = DUE) {
    const before = await everything();
    const storage = fakeStorage();
    expect(await purge(storage, undefined, at, id)).toEqual({
      kind: "skipped",
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(await everything()).toEqual(before);
  }

  it("skips a ritual that is not deleted", async () => {
    expect(
      await lifecycle(fixture.actors.creator, DELETED).restoreRitual(
        command(fixture.actors.creator),
      ),
    ).toMatchObject({ ok: true });
    await expectSkipped();
  });

  it("skips a ritual whose purge_after is still in the future", async () => {
    await expectSkipped(ritualId, new Date(DUE.getTime() - 2 * 3_600_000));
  });

  it("skips a missing ritual", async () => {
    await expectSkipped(createUuidV7());
  });

  it("skips when a restore committed before the claim", async () => {
    expect(
      await lifecycle(fixture.actors.creator).restoreRitual(
        command(fixture.actors.creator),
      ),
    ).toEqual({ ok: true, ritualId });
    await expectSkipped();
    expect((await ritualRow()).deletedAt).toBeNull();
  });
});

describe("interleavings", () => {
  it("refuses a restore once the purge has begun deleting, then completes", async () => {
    const restores: unknown[] = [];
    const storage = fakeStorage({
      onDelete: async (_key, call) => {
        if (call === 1)
          restores.push(
            await lifecycle(fixture.actors.creator).restoreRitual(
              command(fixture.actors.creator),
            ),
          );
      },
    });
    expect(await purge(storage)).toEqual({ kind: "purged" });
    expect(restores).toEqual([
      expect.objectContaining({ ok: false, code: "BEING_REMOVED" }),
    ]);
    expect(await heldForPurged()).toEqual(NOTHING);
  });

  it("lets a second purge of the same ritual run inside the first; the inner one counts it", async () => {
    const inner: unknown[] = [];
    const storage = fakeStorage({
      onDelete: async () => {
        // The inner run's own deletes come here too, before any is counted.
        if (inner.length) return;
        inner.push("running");
        inner[0] = await purge(storage);
      },
    });
    // The outer run finds the row gone: another runner finished and counted it.
    expect(await purge(storage)).toEqual({ kind: "skipped" });
    expect(inner).toEqual([{ kind: "purged" }]);
    expect(logs).toEqual([`purge ${ritualId}: purged`]);
    expect(await heldForPurged()).toEqual(NOTHING);
    expect([...storage.store].sort()).toEqual([...world.foreign].sort());
    // Only the runner that deleted the rows records the purge.
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "purged")),
    ).toHaveLength(1);
  });

  it("keeps the state when the first delete fails, and the rerun completes", async () => {
    const before = await everything();
    const failing = fakeStorage({
      onDelete: () => {
        throw new StorageDown(fixture.parent.title);
      },
    });
    expect(await purge(failing)).toEqual({
      kind: "failed",
      error: "StorageDown",
    });
    expect(failing.deleteObject).toHaveBeenCalledTimes(1);
    expect(failing.listPrefix).not.toHaveBeenCalled();
    const row = await ritualRow();
    expect(row).toMatchObject({
      purgeStartedAt: DUE,
      purgeObjectsDeletedAt: DUE,
      currentRevisionId: fixture.revision.id,
      currentCompiledArtifactId: fixture.artifact.id,
    });
    const after = await everything();
    expect({ ...after, rituals: [] }).toEqual({ ...before, rituals: [] });
    expect(logs).toEqual([
      `purge ${ritualId}: object delete failed (StorageDown)`,
    ]);
    // Not a refusal: the delete may have reached the store, so no cancel.
    expect(
      await lifecycle(fixture.actors.global).cancelRemoval(
        command(fixture.actors.global),
      ),
    ).toMatchObject({ ok: false, code: "NOT_CANCELLABLE" });

    // The rerun, a night later, keeps the original claim.
    const later = new Date(DUE.getTime() + 86_400_000);
    const working = fakeStorage();
    expect(await purge(working, undefined, later)).toEqual({ kind: "purged" });
    expect(await heldForPurged()).toEqual(NOTHING);
    expect([...working.deleted].sort()).toEqual([...world.owned].sort());
  });

  it("refuses cancel removal after the point of no return", async () => {
    const storage = fakeStorage({
      onDelete: (_key, call) => {
        if (call === 2) throw new StorageDown();
      },
    });
    expect(await purge(storage)).toEqual({
      kind: "failed",
      error: "StorageDown",
    });
    expect(storage.deleted).toHaveLength(1);
    expect(
      await lifecycle(fixture.actors.global).cancelRemoval(
        command(fixture.actors.global),
      ),
    ).toMatchObject({ ok: false, code: "NOT_CANCELLABLE" });
    expect(
      await lifecycle(fixture.actors.creator).restoreRitual(
        command(fixture.actors.creator),
      ),
    ).toMatchObject({ ok: false, code: "BEING_REMOVED" });
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
    expect(await purge(fakeStorage())).toEqual({ kind: "purged" });
    expect(await heldForPurged()).toEqual(NOTHING);
  });

  it("names a thrown non-error by the generic class", async () => {
    const storage = fakeStorage({
      onDelete: () => Promise.reject(null),
    });
    expect(await purge(storage)).toEqual({ kind: "failed", error: "Error" });
  });

  it("refuses a save, an upload and a bundle between the claim and the rows", async () => {
    const creator = fixture.actors.creator;
    const at = DUE.getTime();
    const outcomes: Record<string, unknown> = {};
    const uploadLocations = vi.fn(() => {
      throw new Error("never reached");
    });
    const bundleLocations = vi.fn(() => {
      throw new Error("never reached");
    });
    const storage = fakeStorage();
    const result = await purge(storage, {
      afterClaim: async () => {
        expect(storage.deleteObject).not.toHaveBeenCalled();
        outcomes.save = await createSqlRitualWriter(db, async () => creator, {
          now: () => DUE,
        })({
          version: 2,
          operationId: createUuidV7(),
          expectedActorId: creator,
          kind: "save",
          ritualId,
          expectedRevisionId: fixture.revision.id,
          expectedVersion: 7,
          source: "p A save during the purge",
        });
        outcomes.upload = await createSqlRitualUploads(
          db,
          async () => creator,
          {
            locations: uploadLocations,
            now: () => at,
          },
        )
          .initiate({
            version: 1,
            operationId: createUuidV7(),
            expectedActorId: creator,
            ritualId,
            filename: "late.png",
            byteSize: 3,
            contentType: "image/png",
            sha256: hex("late"),
          })
          .catch((error: unknown) => error);
        outcomes.bundle = await createSqlRitualBundlePublisher(
          db,
          async () => creator,
          {
            publicationPolicyId: BUNDLE_FIXTURE_POLICY,
            locations: bundleLocations,
            now: () => at,
          },
        )
          .initiate(
            { operationId: createUuidV7(), expectedActorId: creator },
            fixture.prepared,
          )
          .catch((error: unknown) => error);
      },
    });
    expect(outcomes.save).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(outcomes.upload).toMatchObject({ code: "FORBIDDEN" });
    expect(outcomes.bundle).toMatchObject({ code: "FORBIDDEN" });
    expect(uploadLocations).not.toHaveBeenCalled();
    expect(bundleLocations).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: "purged" });
    expect(await heldForPurged()).toEqual(NOTHING);
    // The refused writes left nothing behind for the purged ritual.
    expect(
      await db
        .select()
        .from(ritualWriteReceipts)
        .where(eq(ritualWriteReceipts.ritualId, ritualId)),
    ).toHaveLength(1);
  });

  it("skips when removal is cancelled before the point of no return", async () => {
    const before = await everything();
    const storage = fakeStorage();
    let cancelled: unknown;
    const result = await purge(storage, {
      afterClaim: async () => {
        cancelled = await lifecycle(fixture.actors.global).cancelRemoval(
          command(fixture.actors.global),
        );
      },
    });
    expect(cancelled).toEqual({ ok: true, ritualId });
    expect(result).toEqual({ kind: "skipped" });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    const row = await ritualRow();
    expect(row).toMatchObject({
      purgeStartedAt: null,
      purgeObjectsDeletedAt: null,
      purgeAfter: new Date(DUE.getTime() + RETENTION_MS),
    });
    const after = await everything();
    expect({ ...after, rituals: [], audit: [] }).toEqual({
      ...before,
      rituals: [],
      audit: [],
    });
    expect(
      await lifecycle(fixture.actors.creator).restoreRitual(
        command(fixture.actors.creator),
      ),
    ).toEqual({ ok: true, ritualId });
    expect((await ritualRow()).deletedAt).toBeNull();
  });

  it("refuses the row delete if the claim vanished while objects went", async () => {
    // Defensive: no service clears a claim after the point of no return, so
    // this is an operator's hand edit.
    const storage = fakeStorage({
      onDelete: async (_key, call) => {
        if (call === 1)
          await db
            .update(rituals)
            .set({ purgeStartedAt: null, purgeObjectsDeletedAt: null })
            .where(eq(rituals.id, ritualId));
      },
    });
    expect(await purge(storage)).toEqual({
      kind: "failed",
      error: "NotClaimed",
    });
    expect(logs).toEqual([`purge ${ritualId}: row delete failed (NotClaimed)`]);
    expect((await heldForPurged()).rituals).toBe(1);
  });
});

describe("a refused first delete", () => {
  const refusing = (error: () => Error, onCall = 1) =>
    fakeStorage({
      onDelete: (_key, call) => {
        if (call === onCall) throw error();
      },
    });
  const cancel = () =>
    lifecycle(fixture.actors.global).cancelRemoval(
      command(fixture.actors.global),
    );

  for (const [label, error, name] of [
    ["AccessDenied", () => new ListDenied(), "AccessDenied"],
    ["a 403", () => new Forbidden(), "Forbidden"],
  ] as const)
    it(`takes back this run's point of no return on ${label}, so it can be cancelled and restored`, async () => {
      const before = await everything();
      const storage = refusing(error);
      expect(await purge(storage)).toEqual({ kind: "failed", error: name });
      expect(storage.deleteObject).toHaveBeenCalledTimes(1);
      expect(storage.deleted).toEqual([]);
      const row = await ritualRow();
      expect(row).toMatchObject({
        purgeStartedAt: DUE,
        purgeObjectsDeletedAt: null,
      });
      const after = await everything();
      expect({ ...after, rituals: [] }).toEqual({ ...before, rituals: [] });
      expect(logs).toEqual([
        `purge ${ritualId}: object delete failed (${name})`,
      ]);
      expect(await cancel()).toEqual({ ok: true, ritualId });
      expect(
        await lifecycle(fixture.actors.creator).restoreRitual(
          command(fixture.actors.creator),
        ),
      ).toEqual({ ok: true, ritualId });
      expect((await ritualRow()).deletedAt).toBeNull();
    });

  it("keeps the mark for a refusal after one delete went through", async () => {
    const storage = refusing(() => new ListDenied(), 2);
    expect(await purge(storage)).toEqual({
      kind: "failed",
      error: "AccessDenied",
    });
    expect(storage.deleted).toHaveLength(1);
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
    expect(await cancel()).toMatchObject({
      ok: false,
      code: "NOT_CANCELLABLE",
    });
  });

  it("keeps a mark an earlier run set, even when this run's first delete is refused", async () => {
    // The first night: a transient failure after the mark.
    expect(await purge(refusing(() => new StorageDown()))).toEqual({
      kind: "failed",
      error: "StorageDown",
    });
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
    // The next night: the very first delete is refused.
    const later = new Date(DUE.getTime() + 86_400_000);
    const storage = refusing(() => new ListDenied());
    expect(await purge(storage, undefined, later)).toEqual({
      kind: "failed",
      error: "AccessDenied",
    });
    expect(storage.deleted).toEqual([]);
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
    expect(await cancel()).toMatchObject({
      ok: false,
      code: "NOT_CANCELLABLE",
    });
  });

  it("logs and keeps the mark when it cannot be taken back", async () => {
    // The third transaction is the one that would clear the mark.
    let transactions = 0;
    const flaky = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "transaction")
          return (...args: Parameters<typeof db.transaction>) => {
            transactions++;
            if (transactions === 3)
              return Promise.reject(new StorageDown("database down"));
            return target.transaction(...args);
          };
        return Reflect.get(target, prop, receiver);
      },
    }) as SqlRitualPurgeDatabase;
    expect(
      await purgeRitual({
        db: flaky,
        storage: refusing(() => new ListDenied()),
        ritualId,
        now: () => DUE,
        log,
      }),
    ).toEqual({ kind: "failed", error: "AccessDenied" });
    expect(transactions).toBe(3);
    expect(logs).toEqual([
      `purge ${ritualId}: object delete failed (AccessDenied)`,
      `purge ${ritualId}: mark kept (StorageDown)`,
    ]);
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
  });
});

describe("stopping at the deadline", () => {
  it("stops between objects, leaves the ritual claimed, and the next run completes it", async () => {
    let ms = 0;
    const storage = fakeStorage({
      onDelete: () => {
        ms += 10;
      },
    });
    expect(
      await purgeRitual({
        db,
        storage,
        ritualId,
        now: () => DUE,
        log,
        deadline: 25,
        clock: () => ms,
      }),
    ).toEqual({ kind: "deferred" });
    // Deletes at 0, 10 and 20 ms; none is sent at 30.
    expect(storage.deleted).toHaveLength(3);
    expect(world.owned.length).toBeGreaterThan(3);
    expect(logs).toEqual([`purge ${ritualId}: deferred at its deadline`]);
    const row = await ritualRow();
    expect(row).toMatchObject({
      purgeStartedAt: DUE,
      purgeObjectsDeletedAt: DUE,
      currentRevisionId: fixture.revision.id,
    });
    expect((await heldForPurged()).rituals).toBe(1);

    // The next night starts from the top; deletes are idempotent.
    logs = [];
    const later = new Date(DUE.getTime() + 86_400_000);
    expect(await purge(storage, undefined, later)).toEqual({ kind: "purged" });
    expect(await heldForPurged()).toEqual(NOTHING);
    expect([...storage.store].sort()).toEqual([...world.foreign].sort());
  });

  it("defers before the first delete when the deadline has already passed", async () => {
    const storage = fakeStorage();
    expect(
      await purgeRitual({
        db,
        storage,
        ritualId,
        now: () => DUE,
        log,
        deadline: 0,
        clock: () => 0,
      }),
    ).toEqual({ kind: "deferred" });
    expect(storage.deleteObject).not.toHaveBeenCalled();
    // Still past the point of no return: a crash here would look the same.
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
  });
});

/** A bare deleted ritual of each scope, due at `purgeAfter`. */
async function bareDeleted(
  purgeAfter: Date,
  scope: "public" | "group" | "temple" = "public",
) {
  const id = createUuidV7();
  await db.insert(rituals).values({
    id,
    title: "Bare synthetic ritual",
    creatorId: fixture.actors.creator,
    scope,
    groupId: scope === "group" ? fixture.groupId : null,
    templeId: scope === "temple" ? fixture.templeId : null,
    minGrade: scope === "temple" ? 0 : null,
    deletedAt: DELETED,
    deletedById: fixture.actors.creator,
    purgeAfter,
  });
  return id;
}
const purgedIds = async () =>
  (
    await db
      .select({ id: auditEvents.subjectId })
      .from(auditEvents)
      .where(eq(auditEvents.action, "purged"))
  ).map((row) => row.id);

describe("purging the rituals that are due", () => {
  beforeEach(async () => {
    // Leave only bare rituals due here.
    for (const id of [ritualId, other.ritualId])
      await db
        .update(rituals)
        .set({ purgeAfter: new Date(DUE.getTime() + 86_400_000) })
        .where(eq(rituals.id, id));
  });
  const at = (offsetHours: number) =>
    new Date(DUE.getTime() - offsetHours * 3_600_000);

  it("builds no storage when nothing is due", async () => {
    const storage = vi.fn(() => fakeStorage());
    expect(
      await purgeDueRituals({
        db,
        storage,
        now: () => DUE,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 0, purged: 0, deferred: 0, failed: 0 });
    expect(storage).not.toHaveBeenCalled();
  });

  it("purges the oldest first, at most limit, and defers the rest", async () => {
    const newest = await bareDeleted(at(1), "temple");
    const oldest = await bareDeleted(at(3), "group");
    const middle = await bareDeleted(at(2));
    const storage = vi.fn(() => fakeStorage({ keys: [] }));
    expect(
      await purgeDueRituals({
        db,
        storage,
        now: () => DUE,
        limit: 2,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 3, purged: 2, deferred: 1, failed: 0 });
    expect(storage).toHaveBeenCalledTimes(1);
    expect(logs).toEqual([
      `purge ${oldest}: purged`,
      `purge ${middle}: purged`,
    ]);
    expect(await ritualRow(newest)).toBeDefined();
    // Each audit row carries its own scope snapshot.
    const audit = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "purged"),
          inArray(auditEvents.subjectId, [oldest, middle]),
        ),
      );
    expect(
      audit
        .map(({ subjectId, scope, templeId, groupId }) => ({
          subjectId,
          scope,
          templeId,
          groupId,
        }))
        .sort((a, b) => a.subjectId.localeCompare(b.subjectId)),
    ).toEqual(
      [
        {
          subjectId: oldest,
          scope: "group",
          templeId: null,
          groupId: fixture.groupId,
        },
        { subjectId: middle, scope: "public", templeId: null, groupId: null },
      ].sort((a, b) => a.subjectId.localeCompare(b.subjectId)),
    );
    // The next night takes the rest.
    expect(
      await purgeDueRituals({
        db,
        storage,
        now: () => DUE,
        limit: 2,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 1, purged: 1, deferred: 0, failed: 0 });
    expect(await purgedIds()).toContain(newest);
  });

  it("starts no new ritual once the deadline has passed", async () => {
    const first = await bareDeleted(at(3));
    await bareDeleted(at(2));
    await bareDeleted(at(1));
    let ms = 0;
    const clock = () => {
      const value = ms;
      ms += 1_000;
      return value;
    };
    expect(
      await purgeDueRituals({
        db,
        storage: () => fakeStorage({ keys: [] }),
        now: () => DUE,
        limit: 5,
        deadlineMs: 1_500,
        clock,
        log,
      }),
    ).toEqual({ due: 3, purged: 1, deferred: 2, failed: 0 });
    expect(await purgedIds()).toEqual([first]);
  });

  it("counts a ritual stopped at the object deadline as deferred; the next run completes it", async () => {
    await db
      .update(rituals)
      .set({ purgeAfter: at(5) })
      .where(eq(rituals.id, ritualId));
    let ms = 0;
    const storage = fakeStorage({
      onDelete: () => {
        ms += 10_000;
      },
    });
    const run = () =>
      purgeDueRituals({
        db,
        storage: () => storage,
        now: () => DUE,
        limit: 5,
        deadlineMs: 35_000,
        objectDeadlineMs: 25_000,
        clock: () => ms,
        log,
      });
    expect(await run()).toEqual({ due: 1, purged: 0, deferred: 1, failed: 0 });
    expect(storage.deleted).toHaveLength(3);
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
    ms = 0;
    expect(
      await purgeDueRituals({
        db,
        storage: () => storage,
        now: () => DUE,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 1, purged: 1, deferred: 0, failed: 0 });
    expect(await heldForPurged()).toEqual(NOTHING);
    expect([...storage.store].sort()).toEqual([...world.foreign].sort());
  });

  it("takes a fresh due ritual before a claimed one a refusal stopped, even with limit 1", async () => {
    // The populated ritual fell due first, but its first delete was refused.
    await db
      .update(rituals)
      .set({ purgeAfter: at(5) })
      .where(eq(rituals.id, ritualId));
    expect(
      await purge(
        fakeStorage({
          onDelete: () => {
            throw new ListDenied();
          },
        }),
      ),
    ).toEqual({ kind: "failed", error: "AccessDenied" });
    const fresh = await bareDeleted(at(1));
    logs = [];
    expect(
      await purgeDueRituals({
        db,
        storage: () => fakeStorage({ keys: [] }),
        now: () => DUE,
        limit: 1,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 2, purged: 1, deferred: 1, failed: 0 });
    expect(logs).toEqual([`purge ${fresh}: purged`]);
    expect((await ritualRow()).purgeStartedAt).toEqual(DUE);
  });

  it("orders unclaimed, then claimed with objects going, then claimed with none", async () => {
    // Each later in purge_after than the next group, so only the claim orders them.
    const without = await bareDeleted(at(4));
    const progress = await bareDeleted(at(3));
    const fresh = await bareDeleted(at(1));
    await db
      .update(rituals)
      .set({ purgeStartedAt: at(0) })
      .where(eq(rituals.id, without));
    await db
      .update(rituals)
      .set({ purgeStartedAt: at(0), purgeObjectsDeletedAt: at(0) })
      .where(eq(rituals.id, progress));
    expect(
      await purgeDueRituals({
        db,
        storage: () => fakeStorage({ keys: [] }),
        now: () => DUE,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 3, purged: 3, deferred: 0, failed: 0 });
    expect(logs).toEqual([
      `purge ${fresh}: purged`,
      `purge ${progress}: purged`,
      `purge ${without}: purged`,
    ]);
  });

  it("counts a ritual another runner finished meanwhile nowhere", async () => {
    await db
      .update(rituals)
      .set({ purgeAfter: at(5) })
      .where(eq(rituals.id, ritualId));
    const inner: unknown[] = [];
    const storage = fakeStorage({
      onDelete: async () => {
        if (inner.length) return;
        inner.push("running");
        inner[0] = await purge(storage);
      },
    });
    expect(
      await purgeDueRituals({
        db,
        storage: () => storage,
        now: () => DUE,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).toEqual({ due: 1, purged: 0, deferred: 0, failed: 0 });
    expect(inner).toEqual([{ kind: "purged" }]);
    expect(await heldForPurged()).toEqual(NOTHING);
  });

  it("counts failures and skips, using the wall clock by default", async () => {
    const bare = await bareDeleted(at(1));
    // The populated ritual falls due first, and its delete fails.
    await db
      .update(rituals)
      .set({ purgeAfter: at(5) })
      .where(eq(rituals.id, ritualId));
    // A due ritual a hook restores before its claim is skipped.
    const restored = await bareDeleted(at(3));
    const storage = fakeStorage({
      onDelete: () => {
        throw new StorageDown();
      },
    });
    let restoredOnce = false;
    const hooks: RitualPurgeHooks = {
      afterClaim: async () => {
        if (restoredOnce) return;
        restoredOnce = true;
        await db
          .update(rituals)
          .set({
            deletedAt: null,
            deletedById: null,
            purgeAfter: null,
            purgeStartedAt: null,
          })
          .where(eq(rituals.id, restored));
      },
    };
    expect(
      await purgeDueRituals({
        db,
        storage: () => storage,
        now: () => DUE,
        limit: 5,
        deadlineMs: 45_000,
        hooks,
        log,
      }),
    ).toEqual({ due: 3, purged: 1, deferred: 0, failed: 1 });
    expect(await purgedIds()).toEqual([bare]);
    expect((await ritualRow(restored)).deletedAt).toBeNull();
    expect((await ritualRow()).purgeObjectsDeletedAt).toEqual(DUE);
  });
});

describe("the nightly job and its heartbeat", () => {
  beforeEach(async () => {
    await db
      .update(rituals)
      .set({ purgeAfter: new Date(DUE.getTime() + 86_400_000) })
      .where(eq(rituals.id, other.ritualId));
  });
  const heartbeat = () => readPurgeHeartbeat(db);
  const START = new Date(DUE.getTime() + 60_000);
  const END = new Date(DUE.getTime() + 120_000);

  it("writes the row at the start and at the finish", async () => {
    expect(await heartbeat()).toBeNull();
    let time = START;
    const seen: unknown[] = [];
    const counts = await runRitualPurgeJob({
      db,
      storage: () =>
        fakeStorage({
          onDelete: async (_key, call) => {
            if (call > 1) return;
            seen.push(await heartbeat());
            time = END;
          },
        }),
      now: () => time,
      limit: 5,
      deadlineMs: 45_000,
      log,
    });
    expect(seen).toEqual([
      {
        job: PURGE_JOB,
        startedAt: START,
        finishedAt: null,
        outcome: null,
        due: null,
        purged: null,
        deferred: null,
        failed: null,
      },
    ]);
    expect(counts).toEqual({ due: 1, purged: 1, deferred: 0, failed: 0 });
    expect(await heartbeat()).toEqual({
      job: PURGE_JOB,
      startedAt: START,
      finishedAt: END,
      outcome: "ok",
      ...counts,
    });
  });

  it("resets the last run's row when a new one starts", async () => {
    await runRitualPurgeJob({
      db,
      storage: () => fakeStorage(),
      now: () => START,
      limit: 5,
      deadlineMs: 45_000,
      log,
    });
    await runRitualPurgeJob({
      db,
      storage: () => fakeStorage(),
      now: () => END,
      limit: 5,
      deadlineMs: 45_000,
      log,
    });
    expect(await heartbeat()).toEqual({
      job: PURGE_JOB,
      startedAt: END,
      finishedAt: END,
      outcome: "ok",
      due: 0,
      purged: 0,
      deferred: 0,
      failed: 0,
    });
  });

  it("records a partial run", async () => {
    await bareDeleted(new Date(DUE.getTime() - 3_600_000));
    const counts = await runRitualPurgeJob({
      db,
      storage: () =>
        fakeStorage({
          onDelete: () => {
            throw new StorageDown();
          },
        }),
      now: () => START,
      limit: 5,
      deadlineMs: 45_000,
      log,
    });
    expect(counts).toEqual({ due: 2, purged: 1, deferred: 0, failed: 1 });
    expect(await heartbeat()).toMatchObject({ outcome: "partial", ...counts });
  });

  it("records a run that failed every ritual", async () => {
    const counts = await runRitualPurgeJob({
      db,
      storage: () => fakeStorage({ bucket: "magickli-preview" }),
      now: () => START,
      limit: 5,
      deadlineMs: 45_000,
      log,
    });
    expect(counts).toEqual({ due: 1, purged: 0, deferred: 0, failed: 1 });
    expect(await heartbeat()).toMatchObject({ outcome: "failed", ...counts });
  });

  it("records a throw from the due query and rethrows it", async () => {
    const failing: SqlRitualPurgeDatabase = {
      transaction: (work, config) =>
        config?.accessMode === "read only"
          ? Promise.reject(new StorageDown("due query"))
          : db.transaction(async (tx) => work(tx), config),
    };
    await expect(
      runRitualPurgeJob({
        db: failing,
        storage: () => fakeStorage(),
        now: () => START,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).rejects.toThrow("due query");
    expect(await heartbeat()).toEqual({
      job: PURGE_JOB,
      startedAt: START,
      finishedAt: START,
      outcome: "failed",
      due: null,
      purged: null,
      deferred: null,
      failed: null,
    });
  });

  it("records a storage factory that throws and rethrows it", async () => {
    await expect(
      runRitualPurgeJob({
        db,
        storage: () => {
          throw new TypeError("no storage configured");
        },
        now: () => START,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).rejects.toThrow(TypeError);
    expect(await heartbeat()).toMatchObject({
      startedAt: START,
      finishedAt: START,
      outcome: "failed",
    });
    expect((await ritualRow()).purgeStartedAt).toBeNull();
  });

  it("rethrows the run's error even when the finish cannot be written", async () => {
    let calls = 0;
    const failing: SqlRitualPurgeDatabase = {
      transaction: (work, config) =>
        ++calls === 1
          ? db.transaction(async (tx) => work(tx), config)
          : Promise.reject(new StorageDown(`transaction ${calls}`)),
    };
    await expect(
      runRitualPurgeJob({
        db: failing,
        storage: () => fakeStorage(),
        now: () => START,
        limit: 5,
        deadlineMs: 45_000,
        log,
      }),
    ).rejects.toThrow("transaction 2");
    expect(await heartbeat()).toMatchObject({
      startedAt: START,
      finishedAt: null,
      outcome: null,
    });
  });

  it("derives the outcome from the counts", () => {
    const counts = { due: 2, deferred: 0 };
    expect(purgeOutcome({ ...counts, purged: 2, failed: 0 })).toBe("ok");
    expect(purgeOutcome({ ...counts, purged: 0, failed: 0 })).toBe("ok");
    expect(purgeOutcome({ ...counts, purged: 1, failed: 1 })).toBe("partial");
    expect(purgeOutcome({ ...counts, purged: 0, failed: 2 })).toBe("failed");
  });
});
