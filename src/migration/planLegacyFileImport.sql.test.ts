import { createHash } from "node:crypto";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { EJSON } from "bson";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { legacyFileSnapshots } from "../db/schema/legacyFiles";
import { legacyIdType } from "../db/schema/legacyIds";
import { loomFilesTable } from "../db/schema/loomFiles";
import { isUuidV7 } from "../lib/ids";
import { planLegacyFileImport } from "./planLegacyFileImport";
import {
  file,
  firstId,
  options,
  secondId,
} from "./planLegacyFileImport.fixture";

const harness = await createMemoryPgliteHarness({
  schema: { loomFilesTable, legacyFileSnapshots, legacyIdType },
});
const { db } = harness;
afterAll(() => harness.client.close());
beforeEach(async () => {
  await db.delete(legacyFileSnapshots);
  await db.delete(loomFilesTable);
});

describe("Loom managed Files schema and protected provenance", () => {
  it("persists the exact metadata/import dates and raw source separately", async () => {
    const plan = planLegacyFileImport([file()], options());
    await db.transaction(async (tx) => {
      await tx.insert(loomFilesTable).values(plan.files);
      await tx.insert(legacyFileSnapshots).values(plan.snapshots);
    });
    const [stored] = await db.select().from(loomFilesTable);
    // PGlite 0.3.16's bare text decoder removes a leading BOM; verify actual
    // UTF-8 bytes and JSON-wrapped read instead of changing stored text.
    const { originalFilename: _bareText, ...storedRest } = stored;
    const { originalFilename: expectedFilename, ...expectedRest } =
      plan.files[0];
    expect(storedRest).toEqual(expectedRest);
    const evidence = await db.execute(
      sql`select json_build_object('value', original_filename) as wrapped, encode(convert_to(original_filename, 'UTF8'), 'hex') as bytes from loom_files`,
    );
    expect(evidence.rows[0].wrapped).toEqual({ value: expectedFilename });
    expect(evidence.rows[0].bytes).toBe(
      Buffer.from(expectedFilename as string).toString("hex"),
    );
    expect(await db.select().from(legacyFileSnapshots)).toEqual(plan.snapshots);
  });
  it("persists a verified prefixed key independently of its unchanged public URL", async () => {
    const prefix = " verified e\u0301 é/";
    const plan = planLegacyFileImport(
      [file()],
      options({ sourceObjectKeyPrefix: prefix }),
    );
    await db.transaction(async (tx) => {
      await tx.insert(loomFilesTable).values(plan.files);
      await tx.insert(legacyFileSnapshots).values(plan.snapshots);
    });
    const [stored] = await db.select().from(legacyFileSnapshots);
    expect(stored).toEqual(plan.snapshots[0]);
    const [metadata] = await db.select().from(loomFilesTable);
    expect(metadata.objectKey).toBe(prefix + "a".repeat(64));
    expect(stored.legacyPublicPath).toBe(`/api/file2?sha256=${"a".repeat(64)}`);
    const bytes = await db.execute(
      sql`select encode(convert_to(source_object_key, 'UTF8'), 'hex') as bytes from legacy_file_snapshots`,
    );
    expect(bytes.rows[0].bytes).toBe(
      Buffer.from(metadata.objectKey).toString("hex"),
    );
  });
  it("retains the bare-key default for existing snapshot insertions", async () => {
    const plan = planLegacyFileImport([file()], options());
    const { sourceObjectKeyPrefix: _explicitEmpty, ...oldSnapshot } =
      plan.snapshots[0];
    await db.insert(loomFilesTable).values(plan.files);
    await db.insert(legacyFileSnapshots).values(oldSnapshot);
    expect(await db.select().from(legacyFileSnapshots)).toEqual(plan.snapshots);
  });
  it("rejects prefix/key/public-path mismatch and absent or malformed archived digest", async () => {
    const plan = planLegacyFileImport(
      [file()],
      options({ sourceObjectKeyPrefix: "verified/" }),
    );
    const modifiedSource = (digest: unknown) => {
      const input = file();
      if (digest === undefined) delete input.sha256;
      else input.sha256 = digest;
      const sourceEjson = EJSON.stringify(input, { relaxed: false });
      return {
        sourceEjson,
        sourceSha256: createHash("sha256").update(sourceEjson).digest("hex"),
      };
    };
    for (const changes of [
      { sourceObjectKey: "a".repeat(64) },
      { sourceObjectKeyPrefix: "other/" },
      {
        sourceObjectKeyPrefix: "wrong",
        sourceObjectKey: `wrong${"a".repeat(64)}`,
      },
      {
        sourceObjectKeyPrefix: "é".repeat(480) + "/",
        sourceObjectKey: `${"é".repeat(480)}/${"a".repeat(64)}`,
      },
      { legacyPublicPath: `/api/file2?sha256=verified/${"a".repeat(64)}` },
      modifiedSource(undefined),
      modifiedSource(null),
      modifiedSource(1),
      modifiedSource("A".repeat(64)),
      modifiedSource("b".repeat(64)),
    ]) {
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(loomFilesTable).values(plan.files);
          await tx
            .insert(legacyFileSnapshots)
            .values({ ...plan.snapshots[0], ...changes });
        }),
      ).rejects.toThrow();
      expect(await db.select().from(loomFilesTable)).toEqual([]);
      expect(await db.select().from(legacyFileSnapshots)).toEqual([]);
    }
  });
  it("keeps the untouched managed UUIDv7 and private defaults for newly inserted metadata", async () => {
    const [inserted] = await db
      .insert(loomFilesTable)
      .values({
        sha256: "b".repeat(64),
        byteSize: 1,
        storageProvider: "unconfigured",
        objectKey: "b".repeat(64),
      })
      .returning();
    expect(isUuidV7(inserted.id)).toBe(true);
    expect(inserted.visibility).toBe("private");
    expect(inserted.ownerId).toBeNull();
  });
  it("enforces Loom's digest uniqueness, while import collisions remain explicit review errors", async () => {
    const plan = planLegacyFileImport([file()], options());
    await db.insert(loomFilesTable).values(plan.files);
    await expect(
      db.insert(loomFilesTable).values({ ...plan.files[0], id: secondId }),
    ).rejects.toThrow();
  });
  it("binds protected evidence to an existing canonical file", async () => {
    const plan = planLegacyFileImport([file()], options());
    await expect(
      db.insert(legacyFileSnapshots).values(plan.snapshots),
    ).rejects.toThrow();
  });
  it("rolls back all metadata when source evidence is altered or bound to a rewritten path", async () => {
    const plan = planLegacyFileImport([file()], options());
    for (const change of [
      { sourceSha256: "0".repeat(64) },
      { legacyPublicPath: "/api/files/new" },
      { sourceObjectKey: "B".repeat(64) },
      { legacySyncUpdatedAtMilliseconds: -1 },
    ]) {
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(loomFilesTable).values(plan.files);
          await tx
            .insert(legacyFileSnapshots)
            .values({ ...plan.snapshots[0], ...change });
        }),
      ).rejects.toThrow();
      expect(await db.select().from(loomFilesTable)).toEqual([]);
    }
  });
  it("keeps a single reviewed baseline per canonical file and preserves it after file metadata changes", async () => {
    const plan = planLegacyFileImport([file()], options());
    await db.insert(loomFilesTable).values(plan.files);
    await db.insert(legacyFileSnapshots).values(plan.snapshots);
    await expect(
      db.insert(legacyFileSnapshots).values({
        ...plan.snapshots[0],
        legacyIdType: "string",
        legacyIdValue: "another-id",
      }),
    ).rejects.toThrow();
    await db
      .update(loomFilesTable)
      .set({
        originalFilename: "new name",
        ownerId: firstId,
        visibility: "private",
      })
      .where(eq(loomFilesTable.id, firstId));
    expect(await db.select().from(legacyFileSnapshots)).toEqual(plan.snapshots);
  });
});
