import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LOCAL_ACCEPTANCE_USERS } from "../../src/auth/localTestIdentities";
import * as auth from "../../src/db/schema/auth";
import { legacyImportRuns } from "../../src/db/schema/legacyImportRuns";
import { seedLocalDevelopmentFixtures } from "./fixtures";

const harness = await createMemoryPgliteHarness({
  schema: { ...auth, legacyImportRuns },
});
const { db } = harness;
afterAll(() => harness.client.close());
beforeEach(async () => {
  await db.delete(auth.user);
  await db.delete(legacyImportRuns);
});

describe("local development fixtures on PGlite", () => {
  it("seeds only Creator and Reader, supports login readiness, and retries safely", async () => {
    await db.transaction((tx) => seedLocalDevelopmentFixtures(tx));
    await db.transaction((tx) => seedLocalDevelopmentFixtures(tx));
    const users = await db.select().from(auth.user);
    expect(users.map((row) => row.id).sort()).toEqual(
      LOCAL_ACCEPTANCE_USERS.filter((row) => row.role !== "admin")
        .map((row) => row.id)
        .sort(),
    );
    expect(await db.select().from(auth.account)).toEqual([]);
    const runs = await db.select().from(legacyImportRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0].profile).toBe("magickli-legacy-import-run-v1");
    expect(runs[0].completedAt).toBeInstanceOf(Date);
    expect(runs[0].reconciliationSha256).toBe(runs[0].expectedRowsSha256);
  });

  it("refuses to reuse a conflicting fixed identity without mutation", async () => {
    const creator = LOCAL_ACCEPTANCE_USERS[0];
    await db.insert(auth.user).values({
      id: creator.id,
      name: "Another person",
      email: creator.email,
    });
    await expect(
      db.transaction((tx) => seedLocalDevelopmentFixtures(tx)),
    ).rejects.toThrow("LOCAL_DEVELOPMENT_FIXTURE_CONFLICT");
    expect(await db.select().from(legacyImportRuns)).toEqual([]);
    expect(
      await db.select().from(auth.user).where(eq(auth.user.id, creator.id)),
    ).toHaveLength(1);
  });

  it("rejects a case-folded email collision before inserting readiness", async () => {
    await db.insert(auth.user).values({
      id: LOCAL_ACCEPTANCE_USERS[2].id,
      name: "Another person",
      email: LOCAL_ACCEPTANCE_USERS[0].email.toUpperCase(),
    });
    await expect(
      db.transaction((tx) => seedLocalDevelopmentFixtures(tx)),
    ).rejects.toThrow("LOCAL_DEVELOPMENT_FIXTURE_CONFLICT");
    expect(await db.select().from(legacyImportRuns)).toEqual([]);
  });
});
