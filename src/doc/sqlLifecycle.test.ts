import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema/index";
import { createUuidV7 } from "../lib/ids";
import { RETENTION_MS } from "./ritualRetention";
import {
  createSqlRitualLifecycleService,
  isDeletedPublicRitual,
} from "./sqlLifecycle";

vi.mock("server-only", () => ({}));

const {
  auditEvents,
  rituals,
  temples,
  templeMemberships,
  user,
  userAccess,
  userGroupGrants,
  userGroups,
} = schema;
const harness = await createMemoryPgliteHarness({ schema });
const queries: string[] = [];
const db = drizzle(harness.client, {
  schema,
  logger: { logQuery: (query) => queries.push(query) },
});
afterAll(() => harness.client.close());

const who = Object.fromEntries(
  [
    "creator",
    "global",
    "templeAdmin",
    "groupAdmin",
    "member",
    "removed",
    "outsider",
  ].map((name) => [name, createUuidV7()]),
);
const ids = {
  alpha: createUuidV7(),
  beta: createUuidV7(),
  group: createUuidV7(),
  temple: createUuidV7(),
  groupRitual: createUuidV7(),
  publicRitual: createUuidV7(),
  betaRitual: createUuidV7(),
};
const when = new Date("2026-10-31T10:00:00.000Z");
const later = new Date("2026-10-31T11:00:00.000Z");

const service = (actor: string | null, now = later) =>
  createSqlRitualLifecycleService(db, async () => actor, { now: () => now });
const request = (actor: string, ritualId = ids.temple) => ({
  version: 1,
  expectedActorId: actor,
  ritualId,
});
const row = async (id = ids.temple) => {
  const [found] = await db.select().from(rituals).where(eq(rituals.id, id));
  return found;
};
const audit = () =>
  db
    .select({
      actorId: auditEvents.actorId,
      subjectKind: auditEvents.subjectKind,
      subjectId: auditEvents.subjectId,
      action: auditEvents.action,
      scope: auditEvents.scope,
      templeId: auditEvents.templeId,
      groupId: auditEvents.groupId,
      at: auditEvents.at,
    })
    .from(auditEvents)
    .orderBy(asc(auditEvents.id));

beforeEach(async () => {
  await db.delete(auditEvents);
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
      name: `Synthetic ${name}`,
      email: `${name}@example.test`,
    })),
  );
  await db.insert(userAccess).values({ userId: who.global, admin: true });
  await db.insert(userGroups).values({ id: ids.group, name: "A group" });
  await db.insert(temples).values([
    { id: ids.alpha, name: "Alpha", slug: "alpha" },
    { id: ids.beta, name: "Beta", slug: "beta" },
  ]);
  await db
    .insert(userGroupGrants)
    .values({ userId: who.groupAdmin, groupId: ids.group, admin: true });
  await db.insert(templeMemberships).values(
    [
      { userId: who.creator, templeId: ids.alpha, grade: 0 },
      { userId: who.templeAdmin, templeId: ids.alpha, grade: 0, admin: true },
      { userId: who.member, templeId: ids.alpha, grade: 9 },
      { userId: who.creator, templeId: ids.beta, grade: 0 },
    ].map((membership) => ({ ...membership, addedAt: when })),
  );
  const base = { creatorId: who.creator, createdAt: when, updatedAt: when };
  await db.insert(rituals).values([
    {
      ...base,
      id: ids.temple,
      title: "Temple ritual",
      scope: "temple",
      templeId: ids.alpha,
      minGrade: 2,
      version: 7,
    },
    {
      ...base,
      id: ids.betaRitual,
      title: "Beta ritual",
      scope: "temple",
      templeId: ids.beta,
      minGrade: 0,
    },
    {
      ...base,
      id: ids.groupRitual,
      title: "Group ritual",
      scope: "group",
      groupId: ids.group,
    },
    {
      ...base,
      id: ids.publicRitual,
      title: "Public ritual",
      scope: "public",
    },
  ]);
  queries.length = 0;
});

describe("deleting a ritual", () => {
  it("hides it, records who and when, and leaves its version alone", async () => {
    expect(
      await service(who.creator).deleteRitual(request(who.creator)),
    ).toEqual({ ok: true, ritualId: ids.temple });
    const deleted = await row();
    expect(deleted).toMatchObject({
      deletedAt: later,
      deletedById: who.creator,
      purgeAfter: new Date(later.getTime() + RETENTION_MS),
      purgeRequestedAt: null,
      purgeStartedAt: null,
      purgeObjectsDeletedAt: null,
      version: 7,
      updatedAt: when,
    });
    expect(deleted.purgeAfter?.toISOString()).toBe("2026-11-30T11:00:00.000Z");
    expect(await audit()).toEqual([
      {
        actorId: who.creator,
        subjectKind: "ritual",
        subjectId: ids.temple,
        action: "delete",
        scope: "temple",
        templeId: ids.alpha,
        groupId: null,
        at: later,
      },
    ]);
  });

  it("locks grants, then the row, in a read committed write", async () => {
    await service(who.templeAdmin).deleteRitual(request(who.templeAdmin));
    const start = queries.findIndex((query) =>
      /set transaction isolation level read committed read write/.test(query),
    );
    expect(start).toBeGreaterThanOrEqual(0);
    const transaction = queries.slice(start);
    expect(transaction[1]).toContain("lock_timeout");
    const lock = transaction.findIndex(
      (query) =>
        query.includes('from "rituals"') && query.endsWith("for update"),
    );
    const grants = transaction.findIndex((query) =>
      query.includes('from "temple_memberships"'),
    );
    expect(grants).toBeGreaterThan(1);
    expect(lock).toBeGreaterThan(grants);
    // The command row lock sees deleted rituals too, by design.
    expect(transaction[lock]).toMatch(/where "rituals"."id" = \$1 for update$/);
  });

  it("is idempotent: deleting again changes and records nothing", async () => {
    await service(who.creator).deleteRitual(request(who.creator));
    const first = await row();
    expect(
      await service(
        who.templeAdmin,
        new Date("2026-11-02T00:00:00Z"),
      ).deleteRitual(request(who.templeAdmin)),
    ).toEqual({ ok: true, ritualId: ids.temple });
    expect(await row()).toEqual(first);
    expect(await audit()).toHaveLength(1);
  });

  it("refuses missing, unauthorised and public rituals alike", async () => {
    const forbidden = {
      ok: false,
      code: "FORBIDDEN",
      message: "You do not have permission to do this to this ritual.",
    };
    expect(await service(who.member).deleteRitual(request(who.member))).toEqual(
      forbidden,
    );
    expect(
      await service(who.removed).deleteRitual(request(who.removed)),
    ).toEqual(forbidden);
    expect(
      await service(who.creator).deleteRitual(
        request(who.creator, createUuidV7()),
      ),
    ).toEqual(forbidden);
    expect(
      await service(who.creator).deleteRitual(
        request(who.creator, ids.publicRitual),
      ),
    ).toEqual(forbidden);
    expect((await row()).deletedAt).toBeNull();
    expect(
      await service(who.global).deleteRitual(
        request(who.global, ids.publicRitual),
      ),
    ).toMatchObject({ ok: true });
    expect(await audit()).toHaveLength(1);
  });

  it("checks the request and the signed-in account", async () => {
    const lifecycle = service(who.creator);
    for (const input of [
      null,
      [],
      "x",
      { ...request(who.creator), extra: 1 },
      { ...request(who.creator), version: 2 },
      request(who.creator, ids.temple.toUpperCase()),
      request("not-an-id"),
    ])
      expect(await lifecycle.deleteRitual(input)).toMatchObject({
        ok: false,
        code: "INVALID_REQUEST",
      });
    expect(
      await service(null).deleteRitual(request(who.creator)),
    ).toMatchObject({ code: "NOT_AUTHENTICATED" });
    expect(
      await service(createUuidV7()).deleteRitual(request(who.creator)),
    ).toMatchObject({ code: "ACCOUNT_CHANGED" });
    const ghost = createUuidV7();
    expect(await service(ghost).deleteRitual(request(ghost))).toMatchObject({
      code: "NOT_AUTHENTICATED",
    });
  });

  it("reports an unexpected database failure as unavailable", async () => {
    const broken = createSqlRitualLifecycleService(
      {
        transaction: async () => {
          throw new Error("synthetic outage");
        },
      } as never,
      async () => who.creator,
    );
    expect(await broken.deleteRitual(request(who.creator))).toEqual({
      ok: false,
      code: "UNAVAILABLE",
      message: "The change could not be saved. Try again.",
    });
  });
});

describe("restoring a ritual", () => {
  it("clears every deletion column and records it", async () => {
    await service(who.creator).deleteRitual(request(who.creator));
    expect(
      await service(who.templeAdmin).restoreRitual(request(who.templeAdmin)),
    ).toEqual({ ok: true, ritualId: ids.temple });
    expect(await row()).toMatchObject({
      deletedAt: null,
      deletedById: null,
      purgeAfter: null,
      version: 7,
      updatedAt: when,
    });
    expect(
      (await audit()).map((event) => [event.action, event.actorId]),
    ).toEqual([
      ["delete", who.creator],
      ["restore", who.templeAdmin],
    ]);
  });

  it("is idempotent on a live ritual", async () => {
    expect(
      await service(who.creator).restoreRitual(request(who.creator)),
    ).toEqual({ ok: true, ritualId: ids.temple });
    expect(await audit()).toEqual([]);
  });

  it("is refused once a permanent deletion or a purge has begun", async () => {
    for (const column of ["purgeRequestedAt", "purgeStartedAt"] as const) {
      await db
        .update(rituals)
        .set({
          deletedAt: when,
          deletedById: who.creator,
          purgeAfter: later,
          purgeRequestedAt: null,
          purgeStartedAt: null,
          [column]: later,
        })
        .where(eq(rituals.id, ids.temple));
      expect(
        await service(who.global).restoreRitual(request(who.global)),
      ).toEqual({
        ok: false,
        code: "BEING_REMOVED",
        message: "It is being removed and can no longer be restored.",
      });
      expect((await row()).deletedAt).toEqual(when);
    }
    expect(await audit()).toEqual([]);
  });

  it("needs the same rights as deleting", async () => {
    await service(who.creator).deleteRitual(request(who.creator));
    expect(
      await service(who.member).restoreRitual(request(who.member)),
    ).toMatchObject({ code: "FORBIDDEN" });
    expect((await row()).deletedAt).not.toBeNull();
  });
});

describe("the delete dialog's read", () => {
  it("names the audience and whether the caller may delete", async () => {
    expect(await service(who.creator).readDeletion(ids.temple)).toEqual({
      ritualId: ids.temple,
      title: "Temple ritual",
      scope: { kind: "temple", templeId: ids.alpha, minGrade: 2 },
      scopeName: "Alpha",
      canDelete: true,
    });
    expect(
      await service(who.groupAdmin).readDeletion(ids.groupRitual),
    ).toMatchObject({ scopeName: "A group", canDelete: true });
    expect(
      await service(who.creator).readDeletion(ids.publicRitual),
    ).toMatchObject({
      scope: { kind: "public" },
      scopeName: "",
      canDelete: false,
    });
    expect(
      await service(who.global).readDeletion(ids.publicRitual),
    ).toMatchObject({ canDelete: true });
  });

  it("reveals nothing to readers, strangers, bad IDs or deleted rituals", async () => {
    expect(await service(who.member).readDeletion(ids.temple)).toBeNull();
    expect(await service(null).readDeletion(ids.temple)).toBeNull();
    expect(await service(who.creator).readDeletion("nope")).toBeNull();
    expect(await service(createUuidV7()).readDeletion(ids.temple)).toBeNull();
    await service(who.creator).deleteRitual(request(who.creator));
    expect(await service(who.global).readDeletion(ids.temple)).toBeNull();
  });
});

describe("Recently deleted", () => {
  const deleteAll = async () => {
    await service(who.creator, when).deleteRitual(request(who.creator));
    await service(who.creator, later).deleteRitual(
      request(who.creator, ids.betaRitual),
    );
    await service(who.groupAdmin, later).deleteRitual(
      request(who.groupAdmin, ids.groupRitual),
    );
    await service(who.global, later).deleteRitual(
      request(who.global, ids.publicRitual),
    );
  };
  const listed = async (actor: string | null, templeSlug?: string) => {
    const { rows, count } = await service(actor).listDeleted(
      templeSlug === undefined ? {} : { templeSlug },
    );
    expect(count).toBe(rows.length);
    return rows.map((item) => item.title);
  };

  it("lists what each caller may restore, newest first", async () => {
    await deleteAll();
    // Same moment: by ID, which follows creation order.
    expect(await listed(who.global)).toEqual([
      "Group ritual",
      "Public ritual",
      "Beta ritual",
      "Temple ritual",
    ]);
    expect(await listed(who.creator)).toEqual([
      "Group ritual",
      "Beta ritual",
      "Temple ritual",
    ]);
    expect(await listed(who.templeAdmin)).toEqual(["Temple ritual"]);
    expect(await listed(who.groupAdmin)).toEqual(["Group ritual"]);
    expect(await listed(who.member)).toEqual([]);
    expect(await listed(null)).toEqual([]);
    expect(await listed(createUuidV7())).toEqual([]);
  });

  it("filters to one temple", async () => {
    await deleteAll();
    expect(await listed(who.global, "alpha")).toEqual(["Temple ritual"]);
    expect(await listed(who.creator, "beta")).toEqual(["Beta ritual"]);
    expect(await listed(who.global, "nowhere")).toEqual([]);
  });

  it("describes each row", async () => {
    await deleteAll();
    await db
      .update(rituals)
      .set({ purgeRequestedAt: later })
      .where(eq(rituals.id, ids.groupRitual));
    const { rows } = await service(who.global).listDeleted();
    expect(rows.find((item) => item.ritualId === ids.temple)).toEqual({
      ritualId: ids.temple,
      title: "Temple ritual",
      scope: "temple",
      scopeName: "Alpha",
      templeSlug: "alpha",
      deletedBy: "Synthetic creator",
      deletedAt: when,
      purgeAfter: new Date(when.getTime() + RETENTION_MS),
      restorable: true,
    });
    expect(
      rows.find((item) => item.ritualId === ids.groupRitual),
    ).toMatchObject({
      scope: "group",
      scopeName: "A group",
      templeSlug: null,
      restorable: false,
    });
    expect(
      rows.find((item) => item.ritualId === ids.publicRitual),
    ).toMatchObject({
      scope: "public",
      scopeName: "",
      deletedBy: "Synthetic global",
    });
  });

  it("is empty when nothing is deleted", async () => {
    expect(await service(who.global).listDeleted()).toEqual({
      rows: [],
      count: 0,
    });
  });
});

describe("a deleted public ritual", () => {
  it("is found only while deleted, public and not purged", async () => {
    expect(await isDeletedPublicRitual(db, ids.publicRitual)).toBe(false);
    await service(who.global).deleteRitual(
      request(who.global, ids.publicRitual),
    );
    await service(who.creator).deleteRitual(request(who.creator));
    expect(await isDeletedPublicRitual(db, ids.publicRitual)).toBe(true);
    expect(await isDeletedPublicRitual(db, ids.temple)).toBe(false);
    expect(await isDeletedPublicRitual(db, createUuidV7())).toBe(false);
    expect(await isDeletedPublicRitual(db, "not-an-id")).toBe(false);
  });
});
