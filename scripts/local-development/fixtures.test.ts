import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_ACCEPTANCE_USERS } from "../../src/auth/localTestIdentities";
import * as auth from "../../src/db/schema/auth";
import { legacyImportRuns } from "../../src/db/schema/legacyImportRuns";
import * as memberships from "../../src/db/schema/memberships";
import { ritualWriteReceipts } from "../../src/db/schema/ritualCommands";
import * as rituals from "../../src/db/schema/rituals";
import { templeCreationReceipts } from "../../src/db/schema/templeCommands";
import { userAccess } from "../../src/db/schema/userProfile";
import { SEMANTIC_SOURCE_FORMAT } from "../../src/doc/semanticCompile";
import {
  LOCAL_DEVELOPMENT_RITUAL_FIXTURE,
  seedLocalDevelopmentFixtures,
  seedLocalDevelopmentRitualFixture,
} from "./fixtures";

vi.mock("server-only", () => ({}));

const harness = await createMemoryPgliteHarness({
  schema: {
    ...auth,
    legacyImportRuns,
    ...memberships,
    ...rituals,
    ritualWriteReceipts,
    templeCreationReceipts,
    userAccess,
  },
});
const { db } = harness;
afterAll(() => harness.client.close());
beforeEach(async () => {
  await db.delete(ritualWriteReceipts);
  await db
    .update(rituals.rituals)
    .set({ currentCompiledArtifactId: null, currentRevisionId: null });
  await db.delete(rituals.ritualCompiledArtifacts);
  await db.delete(rituals.ritualRevisions);
  await db.delete(rituals.rituals);
  await db.delete(templeCreationReceipts);
  await db.delete(memberships.templeMemberships);
  await db.delete(memberships.temples);
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

describe("local development ritual fixture on PGlite", () => {
  it("creates Creator's temple and the full Neophyte once, through the services", async () => {
    const neophyte = readFileSync(
      new URL("../../src/doc/0=0.pug", import.meta.url),
      "utf8",
    );
    await db.transaction((tx) => seedLocalDevelopmentFixtures(tx));
    const first = await seedLocalDevelopmentRitualFixture(db, neophyte);
    const again = await seedLocalDevelopmentRitualFixture(db, neophyte);
    expect(again).toEqual(first);
    const temples = await db.select().from(memberships.temples);
    expect(temples.map((row) => row.name)).toEqual([
      LOCAL_DEVELOPMENT_RITUAL_FIXTURE.templeName,
    ]);
    const members = await db.select().from(memberships.templeMemberships);
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(LOCAL_ACCEPTANCE_USERS[0].id);
    const [ritual] = await db.select().from(rituals.rituals);
    expect(ritual).toMatchObject({
      id: first.ritualId,
      title: LOCAL_DEVELOPMENT_RITUAL_FIXTURE.ritualTitle,
      templeId: first.templeId,
      creatorId: LOCAL_ACCEPTANCE_USERS[0].id,
    });
    const revisions = await db.select().from(rituals.ritualRevisions);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].sourceFormat).toBe(SEMANTIC_SOURCE_FORMAT);
    expect(JSON.parse(revisions[0].source).nodes.length).toBeGreaterThan(400);
  });
});
