import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../db/schema/auth";
import {
  templeInvites,
  templeMemberships,
  temples,
  userGroupGrants,
  userGroups,
} from "../db/schema/memberships";
import { ritualWriteReceipts } from "../db/schema/ritualCommands";
import {
  legacyRitualCompiledArchives,
  ritualCompiledArtifacts,
  ritualRevisions,
  ritualScopeKind,
  rituals,
} from "../db/schema/rituals";
import { userAccess } from "../db/schema/userProfile";
import { createUuidV7 } from "../lib/ids";
import { getRitualAccess } from "./access";
import { loadSqlRitualPrincipal, sqlRitualPolicy } from "./sqlPolicy";
import { createSqlRitualAccessService } from "./sqlScope";

vi.mock("server-only", () => ({}));

const schema = {
  user,
  userAccess,
  temples,
  templeInvites,
  templeMemberships,
  userGroups,
  userGroupGrants,
  rituals,
  ritualRevisions,
  ritualScopeKind,
  ritualWriteReceipts,
  legacyRitualCompiledArchives,
  ritualCompiledArtifacts,
};
const harness = await createMemoryPgliteHarness({ schema });
const db = drizzle(harness.client, { schema });
afterAll(() => harness.client.close());

const who = Object.fromEntries(
  [
    "creator",
    "global",
    "templeAdmin",
    "bothAdmin",
    "groupAdmin",
    "gradeTwo",
    "outsider",
  ].map((name) => [name, createUuidV7()]),
);
const ids = {
  alpha: createUuidV7(),
  beta: createUuidV7(),
  group: createUuidV7(),
  ritual: createUuidV7(),
};
const when = new Date("2026-10-09T10:00:00.000Z");
const later = new Date("2026-10-09T11:00:00.000Z");

const service = (actor: string | null, now = later) =>
  createSqlRitualAccessService(db, async () => actor, { now: () => now });
const request = (
  scope: unknown,
  actor = who.templeAdmin,
  ritualId = ids.ritual,
) => ({ version: 1, expectedActorId: actor, ritualId, scope });
const saved = async () => {
  const [row] = await db
    .select()
    .from(rituals)
    .where(eq(rituals.id, ids.ritual));
  return row;
};
const readerAccess = async (userId: string) => {
  const row = await saved();
  return getRitualAccess(
    sqlRitualPolicy(row),
    await loadSqlRitualPrincipal(db, userId),
  );
};

beforeEach(async () => {
  await db.delete(rituals);
  await db.delete(templeMemberships);
  await db.delete(userGroupGrants);
  await db.delete(temples);
  await db.delete(userGroups);
  await db.delete(userAccess);
  await db.delete(user);
  await db.insert(user).values(
    Object.entries(who).map(([name, id]) => ({
      id,
      name,
      email: `${name}@example.test`,
    })),
  );
  await db.insert(userAccess).values({ userId: who.global, admin: true });
  await db.insert(userGroups).values({ id: ids.group, name: "A group" });
  await db.insert(temples).values([
    { id: ids.alpha, name: "Alpha", slug: "alpha" },
    { id: ids.beta, name: "Beta", slug: "beta" },
  ]);
  await db.insert(userGroupGrants).values({
    userId: who.groupAdmin,
    groupId: ids.group,
    admin: true,
  });
  await db.insert(templeMemberships).values(
    [
      { userId: who.creator, templeId: ids.alpha, grade: 0 },
      { userId: who.templeAdmin, templeId: ids.alpha, grade: 0, admin: true },
      { userId: who.bothAdmin, templeId: ids.alpha, grade: 0, admin: true },
      { userId: who.bothAdmin, templeId: ids.beta, grade: 0, admin: true },
      { userId: who.gradeTwo, templeId: ids.alpha, grade: 2 },
    ].map((row) => ({ ...row, addedAt: when })),
  );
  await db.insert(rituals).values({
    id: ids.ritual,
    title: "A ritual",
    creatorId: who.creator,
    scope: "temple",
    templeId: ids.alpha,
    minGrade: 2,
    version: 7,
    createdAt: when,
    updatedAt: when,
  });
});

describe("reading a ritual's access settings", () => {
  it("shows editors where it stands and only the destinations they administer", async () => {
    expect(await service(who.templeAdmin).read(ids.ritual)).toEqual({
      ritualId: ids.ritual,
      title: "A ritual",
      scope: { kind: "temple", templeId: ids.alpha, minGrade: 2 },
      scopeName: "Alpha",
      options: {
        public: false,
        temples: [{ id: ids.alpha, name: "Alpha" }],
        groups: [],
      },
    });
    expect(
      (await service(who.bothAdmin).read(ids.ritual))?.options.temples,
    ).toEqual([
      { id: ids.alpha, name: "Alpha" },
      { id: ids.beta, name: "Beta" },
    ]);
    expect(await service(who.groupAdmin).read(ids.ritual)).toBeNull();
    // The creator edits but administers nothing, so has nothing to choose.
    expect((await service(who.creator).read(ids.ritual))?.options).toEqual({
      public: false,
      temples: [],
      groups: [],
    });
    expect(await service(who.global).read(ids.ritual)).toMatchObject({
      options: {
        public: true,
        temples: [
          { id: ids.alpha, name: "Alpha" },
          { id: ids.beta, name: "Beta" },
        ],
        groups: [{ id: ids.group, name: "A group" }],
      },
    });
  });

  it("names group and public scopes and reveals nothing to non-editors", async () => {
    await db.update(rituals).set({
      scope: "group",
      groupId: ids.group,
      templeId: null,
      minGrade: null,
    });
    expect((await service(who.global).read(ids.ritual))?.scopeName).toBe(
      "A group",
    );
    await db
      .update(rituals)
      .set({ scope: "public", groupId: null, templeId: null, minGrade: null });
    expect(await service(who.global).read(ids.ritual)).toMatchObject({
      scope: { kind: "public" },
      scopeName: "",
    });
    for (const actor of [who.gradeTwo, who.outsider, null])
      expect(await service(actor).read(ids.ritual)).toBeNull();
    expect(await service(who.global).read(createUuidV7())).toBeNull();
    expect(await service(who.global).read("not-an-id")).toBeNull();
    // A signed-in id with no user row reads nothing.
    expect(await service(createUuidV7()).read(ids.ritual)).toBeNull();
  });
});

describe("changing a ritual's access", () => {
  it("lets a temple administrator change the minimum grade without touching content", async () => {
    const before = await saved();
    expect(
      await service(who.templeAdmin).change(
        request({ kind: "temple", templeId: ids.alpha, minGrade: 5 }),
      ),
    ).toEqual({
      ok: true,
      scope: { kind: "temple", templeId: ids.alpha, minGrade: 5 },
    });
    const after = await saved();
    expect(after).toMatchObject({
      scope: "temple",
      templeId: ids.alpha,
      minGrade: 5,
      version: before.version,
      currentRevisionId: before.currentRevisionId,
      title: "A ritual",
    });
    expect(after.updatedAt).toEqual(later);
    // The grade 2 member could read it at 2 and can no longer.
    expect((await readerAccess(who.gradeTwo)).read).toBe(false);
    await service(who.templeAdmin).change(
      request({ kind: "temple", templeId: ids.alpha, minGrade: 0 }),
    );
    expect((await readerAccess(who.gradeTwo)).read).toBe(true);
  });

  it("moves a ritual to another temple or a group only for someone who administers it", async () => {
    const toBeta = { kind: "temple", templeId: ids.beta, minGrade: 1 };
    expect(
      await service(who.templeAdmin).change(request(toBeta)),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await saved()).templeId).toBe(ids.alpha);
    expect(
      await service(who.bothAdmin).change(request(toBeta, who.bothAdmin)),
    ).toMatchObject({ ok: true });
    expect(await saved()).toMatchObject({
      scope: "temple",
      templeId: ids.beta,
      minGrade: 1,
    });
    const toGroup = { kind: "group", groupId: ids.group };
    expect(
      await service(who.global).change(request(toGroup, who.global)),
    ).toMatchObject({ ok: true });
    expect(await saved()).toMatchObject({
      scope: "group",
      groupId: ids.group,
      templeId: null,
      minGrade: null,
    });
  });

  it("lets only a global administrator make a ritual public, and clears its old scope", async () => {
    expect(
      await service(who.templeAdmin).change(request({ kind: "public" })),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(
      await service(who.global).change(request({ kind: "public" }, who.global)),
    ).toEqual({ ok: true, scope: { kind: "public" } });
    expect(await saved()).toMatchObject({
      scope: "public",
      groupId: null,
      templeId: null,
      minGrade: null,
    });
    // Naming the current scope again is a no-op, even to updatedAt.
    const stamp = (await saved()).updatedAt;
    expect(
      await service(who.global, new Date("2030-01-01T00:00:00Z")).change(
        request({ kind: "public" }, who.global),
      ),
    ).toMatchObject({ ok: true });
    expect((await saved()).updatedAt).toEqual(stamp);
    // Taking it out of public is for global administrators too.
    await db
      .update(rituals)
      .set({ creatorId: who.bothAdmin })
      .where(eq(rituals.id, ids.ritual));
    expect(
      await service(who.bothAdmin).change(
        request(
          { kind: "temple", templeId: ids.alpha, minGrade: 0 },
          who.bothAdmin,
        ),
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await service(who.bothAdmin).read(ids.ritual))?.options).toEqual({
      public: false,
      temples: [],
      groups: [],
    });
    expect(
      await service(who.global).change(
        request(
          { kind: "temple", templeId: ids.alpha, minGrade: 0 },
          who.global,
        ),
      ),
    ).toMatchObject({ ok: true });
  });

  it("refuses non-editors, unknown rituals and missing destinations", async () => {
    const same = { kind: "temple", templeId: ids.alpha, minGrade: 2 };
    for (const actor of [who.gradeTwo, who.outsider, who.groupAdmin])
      expect(await service(actor).change(request(same, actor))).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
    expect(
      await service(who.global).change(
        request(same, who.global, createUuidV7()),
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    for (const scope of [
      { kind: "temple", templeId: createUuidV7(), minGrade: 0 },
      { kind: "group", groupId: createUuidV7() },
    ]) {
      expect(
        await service(who.global).change(request(scope, who.global)),
      ).toMatchObject({ ok: false, code: "NOT_FOUND" });
      // Not telling an administrator of nothing whether a temple exists.
      expect(
        await service(who.templeAdmin).change(request(scope)),
      ).toMatchObject({ ok: false, code: "FORBIDDEN" });
    }
    expect(await saved()).toMatchObject({ templeId: ids.alpha, minGrade: 2 });
  });

  it("rejects malformed requests and switched or missing accounts", async () => {
    const good = request({ kind: "public" }, who.global);
    for (const bad of [
      null,
      [],
      "x",
      { ...good, version: 2 },
      { ...good, extra: true },
      { version: 1, expectedActorId: who.global, ritualId: ids.ritual },
      { ...good, ritualId: "legacy" },
      { ...good, expectedActorId: "nope" },
      { ...good, scope: { kind: "public", templeId: ids.alpha } },
      { ...good, scope: { kind: "group", groupId: "x" } },
      { ...good, scope: { kind: "temple", templeId: ids.alpha, minGrade: -1 } },
      { ...good, scope: { kind: "temple", templeId: "x", minGrade: 0 } },
      {
        ...good,
        scope: { kind: "temple", templeId: ids.alpha, minGrade: 1.5 },
      },
    ])
      expect(await service(who.global).change(bad)).toMatchObject({
        ok: false,
        code: "INVALID_REQUEST",
      });
    expect(await service(who.outsider).change(good)).toMatchObject({
      ok: false,
      code: "ACCOUNT_CHANGED",
    });
    expect(await service(null).change(good)).toMatchObject({
      ok: false,
      code: "NOT_AUTHENTICATED",
    });
    const ghost = createUuidV7();
    expect(
      await service(ghost).change({ ...good, expectedActorId: ghost }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect((await saved()).scope).toBe("temple");
  });

  it("stamps the change with the current time by default", async () => {
    const before = Date.now();
    const clock = createSqlRitualAccessService(db, async () => who.global);
    expect(
      await clock.change(request({ kind: "public" }, who.global)),
    ).toMatchObject({ ok: true });
    expect((await saved()).updatedAt?.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("reports an unreachable database as unavailable", async () => {
    const broken = createSqlRitualAccessService(
      {
        transaction: async () => {
          throw new Error("down");
        },
      },
      async () => who.global,
    );
    expect(
      await broken.change(request({ kind: "public" }, who.global)),
    ).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });

  it("uses fresh grants: an administrator demoted a moment ago can no longer change it", async () => {
    await db
      .update(templeMemberships)
      .set({ admin: false })
      .where(eq(templeMemberships.userId, who.templeAdmin));
    expect(
      await service(who.templeAdmin).change(
        request({ kind: "temple", templeId: ids.alpha, minGrade: 0 }),
      ),
    ).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});
