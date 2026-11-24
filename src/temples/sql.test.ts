import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureLegacyId } from "../db/legacyIds";
import { user } from "../db/schema/auth";
import { legacyIdAliases, legacyIdType } from "../db/schema/legacyIds";
import {
  templeInvites,
  templeJoinFailures,
  templeMemberships,
  temples,
  userGroupGrants,
  userGroups,
} from "../db/schema/memberships";
import { userAccess, userProfile } from "../db/schema/userProfile";
import { getRitualAccess, type RitualPolicy } from "../doc/access";
import { loadSqlRitualPrincipal } from "../doc/sqlPolicy";
import { createUuidV7 } from "../lib/ids";
import {
  JOIN_FAILURES_PER_DAY,
  reserveJoinAttempt,
  returnJoinAttempt,
} from "./joinAttempts";
import {
  createSqlTempleReader,
  createSqlTempleWriter,
  resolveTempleRouteId,
} from "./sql";

vi.mock("server-only", () => ({}));

const schema = {
  user,
  userAccess,
  userProfile,
  legacyIdType,
  legacyIdAliases,
  temples,
  templeInvites,
  templeJoinFailures,
  templeMemberships,
  userGroups,
  userGroupGrants,
};
const harness = await createMemoryPgliteHarness({ schema });
const { db } = harness;
afterAll(() => harness.client.close());

const ids = {
  scopedAdmin: createUuidV7(),
  member: createUuidV7(),
  globalAdmin: createUuidV7(),
  outsider: createUuidV7(),
  temple: createUuidV7(),
  otherTemple: createUuidV7(),
  adminMembership: createUuidV7(),
  memberMembership: createUuidV7(),
  globalMembership: createUuidV7(),
};
const when = new Date("2026-09-13T10:00:00.000Z");
const ALPHA_CODE = "a1pha-5ecre-t0000-00001";
const BETA_CODE = "beta0-5ecre-t0000-00002";

async function membership(
  values: Partial<typeof templeMemberships.$inferInsert> & {
    id: string;
    userId: string;
    templeId: string;
  },
) {
  await db.insert(templeMemberships).values({
    grade: 0,
    admin: false,
    addedAt: when,
    createdAt: when,
    updatedAt: when,
    ...values,
  });
}

beforeEach(async () => {
  await db.delete(templeJoinFailures);
  await db.delete(templeMemberships);
  await db.delete(templeInvites);
  await db.delete(temples);
  await db.delete(legacyIdAliases);
  await db.delete(userProfile);
  await db.delete(userAccess);
  await db.delete(user);
  await db.insert(user).values([
    {
      id: ids.scopedAdmin,
      name: "Scoped account name",
      email: "scoped@example.test",
    },
    {
      id: ids.member,
      name: "Member account name",
      email: "member@example.test",
    },
    {
      id: ids.globalAdmin,
      name: "Global administrator",
      email: "global@example.test",
    },
    {
      id: ids.outsider,
      name: "Outsider",
      email: "outsider@example.test",
    },
  ]);
  await db.insert(userAccess).values({
    userId: ids.globalAdmin,
    admin: true,
  });
  await db.insert(userProfile).values({
    userId: ids.member,
    displayName: "Public member name",
  });
  await db.insert(temples).values([
    {
      id: ids.temple,
      name: "Alpha",
      slug: "alpha",
      createdById: ids.scopedAdmin,
      createdAt: when,
      updatedAt: when,
    },
    {
      id: ids.otherTemple,
      name: "Beta",
      slug: "beta",
      createdById: ids.globalAdmin,
      createdAt: when,
      updatedAt: when,
    },
  ]);
  await db.insert(templeInvites).values([
    { templeId: ids.temple, joinPass: ALPHA_CODE },
    { templeId: ids.otherTemple, joinPass: BETA_CODE },
  ]);
  await membership({
    id: ids.adminMembership,
    userId: ids.scopedAdmin,
    templeId: ids.temple,
    admin: true,
  });
  await membership({
    id: ids.memberMembership,
    userId: ids.member,
    templeId: ids.temple,
    grade: 2,
    motto: "Sub Rosa",
  });
  await membership({
    id: ids.globalMembership,
    userId: ids.globalAdmin,
    templeId: ids.otherTemple,
    admin: false,
  });
});

describe("SQL temple reads", () => {
  it("returns only the caller's public memberships to an ordinary member", async () => {
    const result = await createSqlTempleReader(db).getMyTemples(ids.member);
    expect(result).toEqual([
      {
        id: ids.temple,
        name: "Alpha",
        slug: "alpha",
        membership: { id: ids.memberMembership, grade: 2, admin: false },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(ALPHA_CODE);
    expect(JSON.stringify(result)).not.toContain("example.test");
    expect(
      await createSqlTempleReader(db).getAdminTemple(ids.member, ids.temple),
    ).toBeNull();
  });

  it("exposes invitation and member profile data only to scoped or global admins", async () => {
    const scoped = await createSqlTempleReader(db).getAdminTemple(
      ids.scopedAdmin,
      ids.temple,
    );
    expect(scoped?.joinPass).toBe(ALPHA_CODE);
    expect(scoped?.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          membershipId: ids.memberMembership,
          displayName: "Public member name",
          motto: "Sub Rosa",
        }),
      ]),
    );
    const global = await createSqlTempleReader(db).getManageableTemples(
      ids.globalAdmin,
    );
    expect(global.globalAdmin).toBe(true);
    expect(global.temples.map((temple) => temple.id).sort()).toEqual(
      [ids.temple, ids.otherTemple].sort(),
    );
    expect(
      await createSqlTempleReader(db).getAdminTemple(
        ids.globalAdmin,
        ids.temple,
      ),
    ).not.toBeNull();
  });

  it("resolves old URLs only through the matching collection alias", async () => {
    const oldTempleId = "507f1f77bcf86cd799439011";
    const oldMembershipId = "507f1f77bcf86cd799439012";
    await ensureLegacyId(
      db,
      {
        sourceSystem: "mongodb",
        entityType: "temples",
        legacyIdType: "objectid",
        legacyIdValue: oldTempleId,
      },
      ids.temple,
    );
    await ensureLegacyId(
      db,
      {
        sourceSystem: "mongodb",
        entityType: "templeMemberships",
        legacyIdType: "objectid",
        legacyIdValue: oldMembershipId,
      },
      ids.memberMembership,
    );
    expect(
      await resolveTempleRouteId(db, "temples", oldTempleId.toUpperCase()),
    ).toBe(ids.temple);
    expect(
      await createSqlTempleReader(db).getAdminMembership(
        ids.scopedAdmin,
        oldTempleId,
        oldMembershipId,
      ),
    ).toMatchObject({
      temple: { id: ids.temple },
      membership: { membershipId: ids.memberMembership },
    });
    expect(
      await resolveTempleRouteId(db, "temples", oldMembershipId),
    ).toBeNull();
    expect(
      await resolveTempleRouteId(db, "temples", ids.temple.toUpperCase()),
    ).toBeNull();
  });
});

describe("SQL temple joins", () => {
  it("joins at grade zero and makes retries idempotent", async () => {
    const generateId = vi.fn(() => createUuidV7());
    const writer = createSqlTempleWriter(db, async () => ids.outsider, {
      now: () => when,
      generateId,
    });
    const request = {
      version: 1,
      expectedActorId: ids.outsider,
      slug: " ALPHA ",
      joinPass: ALPHA_CODE,
    };
    const first = await writer.join(request);
    expect(first).toMatchObject({
      ok: true,
      templeId: ids.temple,
      alreadyMember: false,
    });
    const second = await writer.join(request);
    expect(second).toMatchObject({
      ok: true,
      templeId: ids.temple,
      membershipId: first.ok ? first.membershipId : undefined,
      alreadyMember: true,
    });
    expect(generateId).toHaveBeenCalledOnce();
    const [saved] = await db
      .select()
      .from(templeMemberships)
      .where(
        and(
          eq(templeMemberships.userId, ids.outsider),
          eq(templeMemberships.templeId, ids.temple),
        ),
      );
    expect(saved).toMatchObject({ grade: 0, admin: false, addedAt: when });
  });

  it("rejects invalid invitations, switched accounts and overposted grants", async () => {
    const writer = createSqlTempleWriter(db, async () => ids.outsider);
    expect(
      await writer.join({
        version: 1,
        expectedActorId: ids.outsider,
        slug: "alpha",
        joinPass: "wrong",
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INVITE" });
    expect(
      await writer.join({
        version: 1,
        expectedActorId: ids.member,
        slug: "alpha",
        joinPass: ALPHA_CODE,
      }),
    ).toMatchObject({ ok: false, code: "ACCOUNT_CHANGED" });
    expect(
      await writer.join({
        version: 1,
        expectedActorId: ids.outsider,
        slug: "alpha",
        joinPass: ALPHA_CODE,
        admin: true,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(
      await db
        .select()
        .from(templeMemberships)
        .where(eq(templeMemberships.userId, ids.outsider)),
    ).toEqual([]);
  });
});

describe("SQL temple join limits", () => {
  const at = (time: string) => new Date(`2026-11-24T${time}Z`);
  const reader = (now = at("12:00:00")) =>
    createSqlTempleReader(db, { now: () => now });
  const writer = (actorId = ids.outsider, now = at("12:00:00")) =>
    createSqlTempleWriter(db, async () => actorId, { now: () => now });
  const join = (joinPass: string, actorId = ids.outsider, now?: Date) =>
    writer(actorId, now).join({
      version: 1,
      expectedActorId: actorId,
      slug: "alpha",
      joinPass,
    });
  const failures = async (userId = ids.outsider) =>
    (
      await db
        .select({ failures: templeJoinFailures.failures })
        .from(templeJoinFailures)
        .where(eq(templeJoinFailures.userId, userId))
    )[0]?.failures ?? 0;

  it("accepts a code typed with other case and spacing", async () => {
    expect(
      await reader().getJoinPreview(
        ids.outsider,
        "Alpha",
        "A1PHA 5ECRE T0000 0000l",
      ),
    ).toMatchObject({ status: "found", temple: { id: ids.temple } });
    expect(await join("a1pha5ecret000000001")).toMatchObject({ ok: true });
    expect(await failures()).toBe(0);
  });

  it("never matches a stored code that is not in the format", async () => {
    await db
      .update(templeInvites)
      .set({ joinPass: "1234" })
      .where(eq(templeInvites.templeId, ids.temple));
    expect(
      await reader().getJoinPreview(ids.outsider, "alpha", "1234"),
    ).toEqual({ status: "notFound" });
    expect(await join("1234")).toMatchObject({ code: "INVALID_INVITE" });
    expect(
      (await reader().getAdminTemple(ids.scopedAdmin, ids.temple))?.joinPass,
    ).toBeNull();
    expect(await failures()).toBe(2);
  });

  it("counts misses on the page and the join, then refuses even the right code", async () => {
    for (let i = 0; i < JOIN_FAILURES_PER_DAY / 2; i++) {
      expect(
        await reader().getJoinPreview(ids.outsider, "alpha", BETA_CODE),
      ).toEqual({ status: "notFound" });
      expect(await join(`wrong-${i}`)).toMatchObject({
        code: "INVALID_INVITE",
      });
    }
    expect(await failures()).toBe(JOIN_FAILURES_PER_DAY);
    expect(
      await reader().getJoinPreview(ids.outsider, "alpha", ALPHA_CODE),
    ).toEqual({ status: "limited" });
    expect(await join(ALPHA_CODE)).toMatchObject({
      ok: false,
      code: "TOO_MANY_ATTEMPTS",
    });
    expect(
      await db
        .select()
        .from(templeMemberships)
        .where(eq(templeMemberships.userId, ids.outsider)),
    ).toEqual([]);
    expect(await failures()).toBe(JOIN_FAILURES_PER_DAY);
    // Another account is not affected.
    expect(
      await reader().getJoinPreview(ids.globalAdmin, "alpha", ALPHA_CODE),
    ).toMatchObject({ status: "found" });
    // The next UTC day starts again.
    expect(
      await reader(new Date("2026-11-25T00:00:00Z")).getJoinPreview(
        ids.outsider,
        "alpha",
        ALPHA_CODE,
      ),
    ).toMatchObject({ status: "found", alreadyMember: false });
    expect(await failures()).toBe(0);
  });

  it("gives back every lookup whose code matched", async () => {
    for (let i = 0; i < JOIN_FAILURES_PER_DAY * 2; i++) {
      expect(
        await reader().getJoinPreview(ids.outsider, "alpha", ALPHA_CODE),
      ).toMatchObject({ status: "found" });
      expect(await join(ALPHA_CODE)).toMatchObject({ ok: true });
    }
    expect(await failures()).toBe(0);
    for (let i = 0; i < JOIN_FAILURES_PER_DAY; i++)
      expect(await join(BETA_CODE)).toMatchObject({ code: "INVALID_INVITE" });
    expect(await join(BETA_CODE)).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });

  it("gives back a lookup only to the day it was counted in", async () => {
    expect(
      await reserveJoinAttempt(db, ids.outsider, new Date("2026-11-25T08:00Z")),
    ).toBe(true);
    // A lookup reserved just before midnight, given back just after it.
    await returnJoinAttempt(db, ids.outsider, at("23:59:59"));
    expect(await failures()).toBe(1);
  });

  // PGlite has one connection, so these run one after another: the test
  // pins the reserve-before-lookup order and the count, not true
  // concurrency. On PostgreSQL the conditional upsert locks the row and
  // re-checks `failures < limit` against its latest version.
  it("lets parallel guesses past the limit no further", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        reader().getJoinPreview(ids.outsider, "alpha", `guess-${i}`),
      ),
    );
    expect(results.filter((r) => r?.status === "limited")).toHaveLength(
      30 - JOIN_FAILURES_PER_DAY,
    );
    expect(await failures()).toBe(JOIN_FAILURES_PER_DAY);
  });

  it("refuses a stale request from before midnight without resetting the new day", async () => {
    expect(
      await reserveJoinAttempt(db, ids.outsider, new Date("2026-11-25T08:00Z")),
    ).toBe(true);
    expect(await reserveJoinAttempt(db, ids.outsider, at("23:59:59"))).toBe(
      false,
    );
    expect(await failures()).toBe(1);
  });
});

describe("SQL temple administration", () => {
  const updateRequest = () => ({
    version: 1,
    expectedActorId: ids.scopedAdmin,
    templeId: ids.temple,
    membershipId: ids.memberMembership,
    grade: 6,
    admin: true,
    motto: "Lux",
    memberSince: "2024-02-29",
  });

  it("updates the requested membership with bounded grade and a real date", async () => {
    const result = await createSqlTempleWriter(
      db,
      async () => ids.scopedAdmin,
      { now: () => new Date("2026-09-13T11:00:00.000Z") },
    ).updateMembership(updateRequest());
    expect(result).toMatchObject({
      ok: true,
      templeId: ids.temple,
      membershipId: ids.memberMembership,
    });
    const [saved] = await db
      .select()
      .from(templeMemberships)
      .where(eq(templeMemberships.id, ids.memberMembership));
    expect(saved).toMatchObject({ grade: 6, admin: true, motto: "Lux" });
    expect(saved.memberSince?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("rejects ordinary callers, cross-temple IDs, bad grades and bad dates", async () => {
    expect(
      await createSqlTempleWriter(db, async () => ids.member).updateMembership({
        ...updateRequest(),
        expectedActorId: ids.member,
      }),
    ).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(
      await createSqlTempleWriter(
        db,
        async () => ids.scopedAdmin,
      ).updateMembership({
        ...updateRequest(),
        membershipId: ids.globalMembership,
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    for (const patch of [
      { grade: -1 },
      { grade: 7 },
      { grade: 1.5 },
      { memberSince: "2023-02-29" },
      { memberSince: "02/29/2024" },
    ]) {
      expect(
        await createSqlTempleWriter(
          db,
          async () => ids.scopedAdmin,
        ).updateMembership({ ...updateRequest(), ...patch }),
      ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    }
    const [unchanged] = await db
      .select()
      .from(templeMemberships)
      .where(eq(templeMemberships.id, ids.memberMembership));
    expect(unchanged).toMatchObject({ grade: 2, admin: false });
  });

  it("preserves the last temple administrator and lets global admins manage their own membership", async () => {
    const demotion = {
      ...updateRequest(),
      membershipId: ids.adminMembership,
      grade: 0,
      admin: false,
      motto: "",
      memberSince: null,
    };
    expect(
      await createSqlTempleWriter(
        db,
        async () => ids.scopedAdmin,
      ).updateMembership(demotion),
    ).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect(
      await createSqlTempleWriter(
        db,
        async () => ids.scopedAdmin,
      ).updateMembership(updateRequest()),
    ).toMatchObject({ ok: true });
    expect(
      await createSqlTempleWriter(
        db,
        async () => ids.scopedAdmin,
      ).updateMembership(demotion),
    ).toMatchObject({ ok: true });
    expect(
      await createSqlTempleWriter(
        db,
        async () => ids.globalAdmin,
      ).updateMembership({
        ...updateRequest(),
        expectedActorId: ids.globalAdmin,
        templeId: ids.otherTemple,
        membershipId: ids.globalMembership,
      }),
    ).toMatchObject({
      ok: true,
      templeId: ids.otherTemple,
      membershipId: ids.globalMembership,
    });
    const roles = await db
      .select({ id: templeMemberships.id, admin: templeMemberships.admin })
      .from(templeMemberships)
      .where(eq(templeMemberships.templeId, ids.temple));
    expect(roles).toEqual(
      expect.arrayContaining([
        { id: ids.adminMembership, admin: false },
        { id: ids.memberMembership, admin: true },
      ]),
    );
    const [globalMembership] = await db
      .select({ admin: templeMemberships.admin })
      .from(templeMemberships)
      .where(eq(templeMemberships.id, ids.globalMembership));
    expect(globalMembership.admin).toBe(true);
  });

  it("uses fresh SQL grants for invitation changes and never trusts identity metadata", async () => {
    const codes = ["n3wc0-de000-00000-00001", "g10ba-1c0de-00000-00002"];
    const change = (
      actorId: string,
      command: "regenerateInvite" | "disableInvite",
      extra: Record<string, unknown> = {},
    ) =>
      createSqlTempleWriter(db, async () => actorId, {
        generateJoinCode: () => codes.shift() ?? "unused",
      })[command]({
        version: 1,
        expectedActorId: actorId,
        templeId: ids.temple,
        ...extra,
      });
    const stored = async () =>
      (
        await db
          .select()
          .from(templeInvites)
          .where(eq(templeInvites.templeId, ids.temple))
      )[0]?.joinPass;

    expect(await change(ids.scopedAdmin, "regenerateInvite")).toMatchObject({
      ok: true,
    });
    expect(await stored()).toBe("n3wc0-de000-00000-00001");
    expect(
      await change(ids.scopedAdmin, "regenerateInvite", {
        joinPass: "chosen-by-hand",
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    // The old code stops working at once.
    expect(
      await createSqlTempleReader(db).getJoinPreview(
        ids.outsider,
        "alpha",
        ALPHA_CODE,
      ),
    ).toEqual({ status: "notFound" });
    expect(await change(ids.member, "regenerateInvite")).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(await change(ids.member, "disableInvite")).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    await db
      .update(templeMemberships)
      .set({ admin: false })
      .where(eq(templeMemberships.id, ids.adminMembership));
    expect(await change(ids.scopedAdmin, "regenerateInvite")).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(await stored()).toBe("n3wc0-de000-00000-00001");
    expect(await change(ids.globalAdmin, "regenerateInvite")).toMatchObject({
      ok: true,
    });
    expect(await stored()).toBe("g10ba-1c0de-00000-00002");
    expect(await change(ids.globalAdmin, "disableInvite")).toMatchObject({
      ok: true,
    });
    expect(await stored()).toBeUndefined();
    // The other temple's code is untouched throughout.
    expect(
      (
        await db
          .select()
          .from(templeInvites)
          .where(eq(templeInvites.templeId, ids.otherTemple))
      )[0].joinPass,
    ).toBe(BETA_CODE);
  });

  it("creates codes from the system's random source by default", async () => {
    const writer = createSqlTempleWriter(db, async () => ids.scopedAdmin);
    const request = {
      version: 1,
      expectedActorId: ids.scopedAdmin,
      templeId: ids.temple,
    };
    expect(await writer.disableInvite(request)).toMatchObject({ ok: true });
    await writer.regenerateInvite(request);
    const [first] = await db
      .select()
      .from(templeInvites)
      .where(eq(templeInvites.templeId, ids.temple));
    expect(first.joinPass).toMatch(
      /^[0-9a-hjkmnp-tv-z]{5}(-[0-9a-hjkmnp-tv-z]{5}){3}$/,
    );
    await writer.regenerateInvite(request);
    const [second] = await db
      .select()
      .from(templeInvites)
      .where(eq(templeInvites.templeId, ids.temple));
    expect(second.joinPass).not.toBe(first.joinPass);
    expect(
      await createSqlTempleReader(db).getJoinPreview(
        ids.outsider,
        "alpha",
        second.joinPass,
      ),
    ).toMatchObject({ status: "found" });
  });

  it("refuses a generator that makes a code in another format", async () => {
    expect(
      await createSqlTempleWriter(db, async () => ids.scopedAdmin, {
        generateJoinCode: () => "1234",
      }).regenerateInvite({
        version: 1,
        expectedActorId: ids.scopedAdmin,
        templeId: ids.temple,
      }),
    ).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(
      (
        await db
          .select()
          .from(templeInvites)
          .where(eq(templeInvites.templeId, ids.temple))
      )[0].joinPass,
    ).toBe(ALPHA_CODE);
  });
});

describe("SQL temple removal and leaving", () => {
  const remove = (
    actorId: string,
    membershipId: string,
    templeId = ids.temple,
  ) =>
    createSqlTempleWriter(db, async () => actorId).removeMember({
      version: 1,
      expectedActorId: actorId,
      templeId,
      membershipId,
    });
  const leave = (actorId: string, templeId = ids.temple) =>
    createSqlTempleWriter(db, async () => actorId).leave({
      version: 1,
      expectedActorId: actorId,
      templeId,
    });
  const members = async (templeId = ids.temple) =>
    (
      await db
        .select({ userId: templeMemberships.userId })
        .from(templeMemberships)
        .where(eq(templeMemberships.templeId, templeId))
    )
      .map((row) => row.userId)
      .sort();

  it("lets an administrator remove a member, who can then rejoin only at grade zero", async () => {
    expect(await remove(ids.scopedAdmin, ids.memberMembership)).toEqual({
      ok: true,
      templeId: ids.temple,
      removedSelf: false,
    });
    expect(await members()).toEqual([ids.scopedAdmin]);
    expect(await createSqlTempleReader(db).getMyTemples(ids.member)).toEqual(
      [],
    );

    const rejoined = await createSqlTempleWriter(
      db,
      async () => ids.member,
    ).join({
      version: 1,
      expectedActorId: ids.member,
      slug: "alpha",
      joinPass: ALPHA_CODE,
    });
    expect(rejoined).toMatchObject({ ok: true, alreadyMember: false });
    const [again] = await db
      .select()
      .from(templeMemberships)
      .where(eq(templeMemberships.userId, ids.member));
    expect(again).toMatchObject({ grade: 0, admin: false, motto: null });
    expect(again.id).not.toBe(ids.memberMembership);
  });

  it("refuses everyone who is not currently an administrator, using fresh grants", async () => {
    expect(await remove(ids.member, ids.adminMembership)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(await remove(ids.outsider, ids.memberMembership)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    await db
      .update(templeMemberships)
      .set({ admin: false })
      .where(eq(templeMemberships.id, ids.adminMembership));
    expect(await remove(ids.scopedAdmin, ids.memberMembership)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(await members()).toEqual([ids.member, ids.scopedAdmin].sort());
  });

  it("only removes memberships of the named temple and rejects bad requests", async () => {
    expect(
      await remove(ids.scopedAdmin, ids.globalMembership, ids.temple),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await members(ids.otherTemple)).toEqual([ids.globalAdmin]);
    expect(await remove(ids.scopedAdmin, createUuidV7())).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    const writer = createSqlTempleWriter(db, async () => ids.scopedAdmin);
    for (const request of [
      null,
      [],
      { version: 1, expectedActorId: ids.scopedAdmin, templeId: ids.temple },
      {
        version: 2,
        expectedActorId: ids.scopedAdmin,
        templeId: ids.temple,
        membershipId: ids.memberMembership,
      },
      {
        version: 1,
        expectedActorId: ids.scopedAdmin,
        templeId: ids.temple,
        membershipId: ids.memberMembership,
        admin: true,
      },
    ])
      expect(await writer.removeMember(request)).toMatchObject({
        ok: false,
        code: "INVALID_REQUEST",
      });
    expect(
      await writer.removeMember({
        version: 1,
        expectedActorId: ids.member,
        templeId: ids.temple,
        membershipId: ids.memberMembership,
      }),
    ).toMatchObject({ ok: false, code: "ACCOUNT_CHANGED" });
    expect(await members()).toEqual([ids.member, ids.scopedAdmin].sort());
  });

  it("keeps the last administrator whether they are removed, remove themselves or leave", async () => {
    for (const result of [
      await remove(ids.scopedAdmin, ids.adminMembership),
      await leave(ids.scopedAdmin),
      await remove(ids.globalAdmin, ids.adminMembership),
    ])
      expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect(await members()).toEqual([ids.member, ids.scopedAdmin].sort());

    // With a second administrator the first may go.
    await db
      .update(templeMemberships)
      .set({ admin: true })
      .where(eq(templeMemberships.id, ids.memberMembership));
    expect(await leave(ids.scopedAdmin)).toEqual({
      ok: true,
      templeId: ids.temple,
      removedSelf: true,
    });
    expect(await members()).toEqual([ids.member]);
  });

  it("reports when an administrator removed their own membership", async () => {
    await db
      .update(templeMemberships)
      .set({ admin: true })
      .where(eq(templeMemberships.id, ids.memberMembership));
    expect(await remove(ids.scopedAdmin, ids.adminMembership)).toMatchObject({
      ok: true,
      removedSelf: true,
    });
    // Now the only administrator, they cannot remove themselves too.
    expect(await remove(ids.member, ids.memberMembership)).toMatchObject({
      ok: false,
      code: "LAST_ADMIN",
    });
  });

  it("lets a global administrator remove members of any temple", async () => {
    expect(await remove(ids.globalAdmin, ids.memberMembership)).toMatchObject({
      ok: true,
    });
    expect(await members()).toEqual([ids.scopedAdmin]);
  });

  it("lets a member leave on their own, once, and nobody else's temple", async () => {
    expect(await leave(ids.member)).toEqual({
      ok: true,
      templeId: ids.temple,
      removedSelf: true,
    });
    expect(await members()).toEqual([ids.scopedAdmin]);
    expect(await leave(ids.member)).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await leave(ids.outsider)).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await members(ids.otherTemple)).toEqual([ids.globalAdmin]);
    const writer = createSqlTempleWriter(db, async () => ids.member);
    expect(
      await writer.leave({
        version: 1,
        expectedActorId: ids.outsider,
        templeId: ids.temple,
      }),
    ).toMatchObject({ ok: false, code: "ACCOUNT_CHANGED" });
    for (const request of [
      null,
      { version: 1, expectedActorId: ids.member },
      {
        version: 1,
        expectedActorId: ids.member,
        templeId: ids.temple,
        membershipId: ids.adminMembership,
      },
    ])
      expect(await writer.leave(request)).toMatchObject({
        ok: false,
        code: "INVALID_REQUEST",
      });
    expect(await leave(ids.member, createUuidV7())).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("ends the removed person's ritual access, creator rights included", async () => {
    const ritual = (minGrade: number): RitualPolicy => ({
      id: createUuidV7(),
      creatorId: ids.member,
      scope: { kind: "temple", templeId: ids.temple, minGrade },
    });
    const access = async (policy: RitualPolicy) =>
      getRitualAccess(policy, await loadSqlRitualPrincipal(db, ids.member));
    const reachable = ritual(2);
    const beyond = ritual(5);
    // Still a member: reads at their grade, and edits what they created.
    const keeps = { read: true, edit: true, readSourceHistory: true };
    expect(await access(reachable)).toEqual(keeps);
    expect(await access(beyond)).toEqual(keeps);
    await remove(ids.scopedAdmin, ids.memberMembership);
    const gone = { read: false, edit: false, readSourceHistory: false };
    expect(await access(reachable)).toEqual(gone);
    expect(await access(beyond)).toEqual(gone);
  });
});
