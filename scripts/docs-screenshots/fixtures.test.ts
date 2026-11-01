import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_ACCEPTANCE_USERS } from "../../src/auth/localTestIdentities";
import * as schema from "../../src/db/schema/index";
import { SCREENSHOT_RITUALS, seedDocsScreenshotFixtures } from "./fixtures";

vi.mock("server-only", () => ({}));

const { rituals, ritualRevisions, ritualCompiledArtifacts } = schema;
const harness = await createMemoryPgliteHarness({ schema });
const { db } = harness;
afterAll(() => harness.client.close());

beforeEach(async () => {
  const tables = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = tables.rows.map((row) => `"${row.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`truncate ${names} cascade`));
});

/** Synthetic stand-in for the bundled 0=0 source. */
const NEOPHYTE = `title(text="Opening of the Neophyte Hall") Opening of the Neophyte Hall
summary(summary="Preparation")
  task(say role="hiero") The Hall is opened.
`;
const RETIRED = "Retired opening (sample)";
const ZELATOR = "Zelator 1=10 (sample)";

const seed = () => seedDocsScreenshotFixtures(db, NEOPHYTE);

const rowsTitled = (title: string) =>
  db
    .select({
      id: rituals.id,
      deletedAt: rituals.deletedAt,
      purgeRequestedAt: rituals.purgeRequestedAt,
      purgeStartedAt: rituals.purgeStartedAt,
    })
    .from(rituals)
    .where(eq(rituals.title, title));

/** What a local purge leaves: the rows gone, the receipt kept. */
async function purge(ritualId: string) {
  await db
    .update(rituals)
    .set({ currentRevisionId: null, currentCompiledArtifactId: null })
    .where(eq(rituals.id, ritualId));
  const revisions = db
    .select({ id: ritualRevisions.id })
    .from(ritualRevisions)
    .where(eq(ritualRevisions.ritualId, ritualId));
  await db
    .delete(ritualCompiledArtifacts)
    .where(inArray(ritualCompiledArtifacts.revisionId, revisions));
  await db
    .delete(ritualRevisions)
    .where(eq(ritualRevisions.ritualId, ritualId));
  await db.delete(rituals).where(eq(rituals.id, ritualId));
}

const deletedAt = new Date("2026-10-01T00:00:00.000Z");
const markDeleted = (id: string, extra: Partial<typeof rituals.$inferInsert>) =>
  db
    .update(rituals)
    .set({
      deletedAt,
      deletedById: CREATOR,
      purgeAfter: new Date("2026-11-01T00:00:00.000Z"),
      ...extra,
    })
    .where(eq(rituals.id, id));
const CREATOR = LOCAL_ACCEPTANCE_USERS.find((u) => u.role === "creator")!.id;

describe("docs screenshot seed on PGlite", () => {
  it("creates all four samples, the retired one deleted, and reruns idempotently", async () => {
    const first = await seed();
    expect(Object.keys(first.rituals).sort()).toEqual(
      SCREENSHOT_RITUALS.map((r) => r.title).sort(),
    );
    const all = await db
      .select({ title: rituals.title, deletedAt: rituals.deletedAt })
      .from(rituals)
      .where(eq(rituals.templeId, first.templeId));
    expect(all).toHaveLength(4);
    for (const row of all)
      expect(!!row.deletedAt, row.title).toBe(row.title === RETIRED);

    const counts = async () => ({
      rituals: (await db.select({ id: rituals.id }).from(rituals)).length,
      revisions: (
        await db.select({ id: ritualRevisions.id }).from(ritualRevisions)
      ).length,
      receipts: (
        await db
          .select({ id: schema.ritualWriteReceipts.operationId })
          .from(schema.ritualWriteReceipts)
      ).length,
      audits: (
        await db.select({ id: schema.auditEvents.id }).from(schema.auditEvents)
      ).length,
    });
    const before = await counts();
    const second = await seed();
    expect(second).toEqual(first);
    expect(await counts()).toEqual(before);
  });

  it("restores a deleted sample on the next run", async () => {
    const first = await seed();
    const id = first.rituals[ZELATOR]!;
    await markDeleted(id, {});
    const second = await seed();
    expect(second.rituals[ZELATOR]).toBe(id);
    const rows = await rowsTitled(ZELATOR);
    expect(rows).toEqual([
      { id, deletedAt: null, purgeRequestedAt: null, purgeStartedAt: null },
    ]);
  });

  it.each([
    ["requested", { purgeRequestedAt: deletedAt }],
    ["started", { purgeStartedAt: deletedAt }],
  ] as const)(
    "creates a fresh sample beside one whose purge was %s",
    async (_, extra) => {
      const first = await seed();
      const id = first.rituals[ZELATOR]!;
      await markDeleted(id, extra);
      const [old] = await rowsTitled(ZELATOR);

      const second = await seed();
      const fresh = second.rituals[ZELATOR]!;
      expect(fresh).not.toBe(id);
      const rows = await rowsTitled(ZELATOR);
      expect(rows).toHaveLength(2);
      expect(rows.find((r) => r.id === id)).toEqual(old);
      expect(rows.find((r) => r.id === fresh)?.deletedAt).toBeNull();

      // And the run after that keeps the fresh one.
      expect((await seed()).rituals[ZELATOR]).toBe(fresh);
      expect(await rowsTitled(ZELATOR)).toHaveLength(2);
    },
  );

  it("recreates a purged sample though its receipt remains", async () => {
    const first = await seed();
    const id = first.rituals[ZELATOR]!;
    await purge(id);
    const second = await seed();
    const fresh = second.rituals[ZELATOR]!;
    expect(fresh).not.toBe(id);
    expect(await rowsTitled(ZELATOR)).toEqual([
      {
        id: fresh,
        deletedAt: null,
        purgeRequestedAt: null,
        purgeStartedAt: null,
      },
    ]);
    // Purging the recreated one too still works: the fixed ID's receipt
    // stays used, so each recreation takes a fresh ID.
    await purge(fresh);
    const third = await seed();
    expect(third.rituals[ZELATOR]).not.toBe(fresh);
    expect(await rowsTitled(ZELATOR)).toHaveLength(1);
  });

  it("keeps the retired sample deleted, deleting it again if restored", async () => {
    const first = await seed();
    const id = first.rituals[RETIRED]!;
    const [deleted] = await rowsTitled(RETIRED);
    expect(deleted?.deletedAt).not.toBeNull();

    await seed();
    expect(await rowsTitled(RETIRED)).toEqual([deleted]);

    await db
      .update(rituals)
      .set({ deletedAt: null, deletedById: null, purgeAfter: null })
      .where(eq(rituals.id, id));
    expect((await seed()).rituals[RETIRED]).toBe(id);
    const [again] = await rowsTitled(RETIRED);
    expect(again?.id).toBe(id);
    expect(again?.deletedAt).not.toBeNull();
  });

  it("leaves a retired sample being removed alone, and recreates it once purged", async () => {
    const first = await seed();
    const id = first.rituals[RETIRED]!;
    await db
      .update(rituals)
      .set({ purgeRequestedAt: new Date() })
      .where(eq(rituals.id, id));
    const [removing] = await rowsTitled(RETIRED);

    expect((await seed()).rituals[RETIRED]).toBe(id);
    expect(await rowsTitled(RETIRED)).toEqual([removing]);

    await purge(id);
    const recreated = (await seed()).rituals[RETIRED]!;
    expect(recreated).not.toBe(id);
    const [row] = await rowsTitled(RETIRED);
    expect(row?.id).toBe(recreated);
    expect(row?.deletedAt).not.toBeNull();
  });
});
