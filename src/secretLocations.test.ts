import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { createSecrets, staticKeyring } from "@gadicc/loom/secrets";
import {
  defineSecretLocations,
  reportSecretLocations,
  resealSecretLocations,
  verifySecretLocations,
} from "@gadicc/loom/secrets/maintenance";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "./db/schema/auth";
import { templeForums } from "./db/schema/discourse";
import { templeMemberships, temples } from "./db/schema/memberships";
import { createUuidV7 } from "./lib/ids";
import { secretLocations, templeForumKeyLocation } from "./secretLocations";
import { loadTempleForumCredentials } from "./temples/forum";
import { forumKeyBinding } from "./temples/forumKeys";

vi.mock("server-only", () => ({}));

const harness = await createMemoryPgliteHarness({
  schema: { user, temples, templeMemberships, templeForums },
});
const { db } = harness;
afterAll(() => harness.client.close());

// Obviously synthetic keys: thirty-two copies of one byte.
const keys = { 1: new Uint8Array(32).fill(1), 2: new Uint8Array(32).fill(2) };
const purposeWith = (activeKeyId: number) =>
  createSecrets({ keys: staticKeyring(keys, activeKeyId) }).purpose(
    "temple-forum.api-key",
  );
const first = purposeWith(1);
const second = purposeWith(2);
const locationsFor = (purpose: typeof first) =>
  defineSecretLocations([templeForumKeyLocation(purpose)]);

const templeIds = [createUuidV7(), createUuidV7(), createUuidV7()].sort();
const rowFor = (templeId: string, index: number) => ({
  templeId,
  origin: `https://forum${index}.example.org`,
  apiUsername: "system",
});
const sealedBy = async () =>
  Object.fromEntries(
    (await db.select().from(templeForums)).map((row) => [
      row.templeId,
      row.apiKeyEncrypted,
    ]),
  );

beforeEach(async () => {
  await db.delete(templeForums);
  await db.delete(temples);
  await db.insert(temples).values(
    templeIds.map((id, index) => ({
      id,
      name: `Temple ${index}`,
      slug: `temple-${index}`,
    })),
  );
  for (const [index, templeId] of templeIds.entries()) {
    const row = rowFor(templeId, index);
    await db.insert(templeForums).values({
      templeId,
      forumOrigin: row.origin,
      apiUsername: row.apiUsername,
      apiKeyEncrypted: await first.seal(`key-${index}`, forumKeyBinding(row)),
    });
  }
});

describe("the declared secret locations", () => {
  it("declares the forum key column for the application's own purpose", () => {
    expect(
      secretLocations.map(({ name, purpose }) => [name, purpose.name]),
    ).toEqual([["temple_forums.api_key_encrypted", "temple-forum.api-key"]]);
  });

  it("reports and verifies every row, a page at a time", async () => {
    const [report] = await reportSecretLocations(db, locationsFor(first), {
      batchSize: 2,
    });
    expect(report).toMatchObject({
      rows: 3,
      done: true,
      byKeyId: { 1: 3 },
      failureCount: 0,
    });
    const [verified] = await verifySecretLocations(db, locationsFor(first), {
      batchSize: 1,
    });
    expect(verified).toMatchObject({
      rows: 3,
      done: true,
      opened: 3,
      failureCount: 0,
    });
  });

  it("agrees with the forum service about which rows open", async () => {
    // Someone with database access changes who the key acts as.
    await db
      .update(templeForums)
      .set({ apiUsername: "intruder" })
      .where(eq(templeForums.templeId, templeIds[1]));
    const [verified] = await verifySecretLocations(db, locationsFor(first));
    expect(verified).toMatchObject({
      opened: 2,
      failureCount: 1,
      failures: [{ id: templeIds[1], reason: "authentication" }],
    });
    expect(
      await Promise.all(
        templeIds.map(
          async (id) => (await loadTempleForumCredentials(db, id, first)).kind,
        ),
      ),
    ).toEqual(["ready", "unreadable", "ready"]);
  });

  it("moves rows to the active key, and only when asked to write", async () => {
    const before = await sealedBy();
    const [rehearsal] = await resealSecretLocations(db, locationsFor(second), {
      allowUnverifiedKeys: true,
    });
    expect(rehearsal).toMatchObject({ dryRun: true, resealed: 3, changed: 0 });
    expect(await sealedBy()).toEqual(before);

    const [moved] = await resealSecretLocations(db, locationsFor(second), {
      dryRun: false,
      allowUnverifiedKeys: true,
      batchSize: 2,
    });
    expect(moved).toMatchObject({
      dryRun: false,
      done: true,
      resealed: 3,
      changed: 0,
      failureCount: 0,
    });
    const [report] = await reportSecretLocations(db, locationsFor(second));
    expect(report.byKeyId).toEqual({ 2: 3 });
    // Still the same keys, readable where the forum service looks.
    for (const [index, templeId] of templeIds.entries()) {
      const [row] = await db
        .select()
        .from(templeForums)
        .where(eq(templeForums.templeId, templeId));
      expect(row.apiKeyEncrypted).not.toBe(before[templeId]);
      expect(
        await second.tryOpen(
          row.apiKeyEncrypted,
          forumKeyBinding(rowFor(templeId, index)),
        ),
      ).toBe(`key-${index}`);
    }
    const [again] = await resealSecretLocations(db, locationsFor(second), {
      dryRun: false,
      allowUnverifiedKeys: true,
    });
    expect(again).toMatchObject({ current: 3, resealed: 0 });
  });

  it("leaves a row alone that changed after it was read, and never adds one", async () => {
    const location = templeForumKeyLocation(second);
    const [row] = await location.read(db, null, 1);
    expect(await location.write(db, row.id, "something-else", "next")).toBe(
      false,
    );
    expect((await sealedBy())[row.id]).toBe(row.sealed);
    await db.delete(templeForums).where(eq(templeForums.templeId, row.id));
    expect(await location.write(db, row.id, row.sealed, "next")).toBe(false);
    expect(Object.keys(await sealedBy())).toHaveLength(2);
    // Paging continues after the cursor, in the database's own order.
    expect(
      (await location.read(db, templeIds[0], 5)).map(({ id }) => id),
    ).toEqual(templeIds.slice(1));
  });
});
