import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../db/schema/auth";
import { templeForums } from "../db/schema/discourse";
import { legacyIdAliases, legacyIdType } from "../db/schema/legacyIds";
import { templeMemberships, temples } from "../db/schema/memberships";
import { userAccess } from "../db/schema/userProfile";
import { createUuidV7 } from "../lib/ids";
import {
  checkForumAdminKey,
  createSqlTempleForumService,
  loadTempleForumCredentials,
  resolveForumSyncTarget,
} from "./forum";

vi.mock("server-only", () => ({}));
// Nothing here may touch the network.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => {
    throw new Error("ENOTFOUND");
  }),
}));

const schema = {
  user,
  userAccess,
  legacyIdType,
  legacyIdAliases,
  temples,
  templeMemberships,
  templeForums,
};
const harness = await createMemoryPgliteHarness({ schema });
const { db } = harness;
afterAll(() => harness.client.close());

const ids = {
  admin: createUuidV7(),
  otherAdmin: createUuidV7(),
  member: createUuidV7(),
  global: createUuidV7(),
  outsider: createUuidV7(),
  temple: createUuidV7(),
  other: createUuidV7(),
};
const when = new Date("2026-10-09T10:00:00.000Z");
const env = { BETTER_AUTH_SECRET: "test-secret" };
const publicHost = async () => [{ address: "93.184.216.34", family: 4 }];
const KEY = "0123456789abcdef0123456789abcdef";

const service = (
  actor: string | null,
  overrides: Parameters<typeof createSqlTempleForumService>[2] = {},
) =>
  createSqlTempleForumService(db, async () => actor, {
    env,
    lookup: publicHost,
    now: () => when,
    checkKey: async () => ({ ok: true }),
    ...overrides,
  });
const save = (actor: string, extra: Record<string, unknown> = {}) =>
  service(actor).save({
    version: 1,
    expectedActorId: actor,
    templeId: ids.temple,
    origin: "https://forum.example.org",
    apiUsername: "system",
    apiKey: KEY,
    ...extra,
  });
const stored = async () =>
  (
    await db
      .select()
      .from(templeForums)
      .where(eq(templeForums.templeId, ids.temple))
  )[0];

beforeEach(async () => {
  await db.delete(templeForums);
  await db.delete(templeMemberships);
  await db.delete(temples);
  await db.delete(userAccess);
  await db.delete(user);
  await db.insert(user).values(
    Object.entries(ids)
      .filter(([name]) => !name.includes("emple") && name !== "other")
      .map(([name, id]) => ({ id, name, email: `${name}@example.test` })),
  );
  await db.insert(userAccess).values({ userId: ids.global, admin: true });
  await db.insert(temples).values([
    { id: ids.temple, name: "Alpha", slug: "alpha" },
    { id: ids.other, name: "Beta", slug: "beta" },
  ]);
  await db.insert(templeMemberships).values(
    [
      { userId: ids.admin, templeId: ids.temple, grade: 0, admin: true },
      { userId: ids.member, templeId: ids.temple, grade: 1 },
      { userId: ids.otherAdmin, templeId: ids.other, grade: 0, admin: true },
    ].map((row) => ({ ...row, addedAt: when })),
  );
});

describe("saving a temple's forum connection", () => {
  it("stores the address and an encrypted key, and never returns the key", async () => {
    expect(await save(ids.admin)).toEqual({ ok: true });
    const row = await stored();
    expect(row).toMatchObject({
      forumOrigin: "https://forum.example.org",
      apiUsername: "system",
      apiKeyHint: "cdef",
      updatedById: ids.admin,
    });
    expect(row.apiKeyEncrypted).not.toContain(KEY);
    const read = await service(ids.admin).read(ids.temple);
    expect(read).toEqual({
      settings: {
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKeyHint: "cdef",
        updatedAt: row.updatedAt,
      },
    });
    expect(JSON.stringify(read)).not.toContain(KEY);
    const credentials = await loadTempleForumCredentials(db, ids.temple, env);
    expect(credentials).toEqual({
      kind: "ready",
      credentials: {
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      },
    });
  });

  it("keeps the saved key when only the username changes, but not when the address does", async () => {
    await save(ids.admin);
    const before = (await stored()).apiKeyEncrypted;
    expect(
      await save(ids.admin, { apiKey: "", apiUsername: "  bot.user " }),
    ).toEqual({ ok: true });
    expect(await stored()).toMatchObject({
      apiUsername: "bot.user",
      apiKeyEncrypted: before,
    });
    expect(
      await save(ids.admin, { apiKey: "", origin: "forum.other.org" }),
    ).toMatchObject({
      ok: false,
      message: "Enter the API key again when you change the forum address.",
    });
    expect((await stored()).forumOrigin).toBe("https://forum.example.org");
    expect(
      await save(ids.admin, {
        apiKey: "n3w-k3y-n3w-k3y",
        origin: "forum.other.org",
      }),
    ).toEqual({ ok: true });
    expect(await loadTempleForumCredentials(db, ids.temple, env)).toMatchObject(
      {
        credentials: {
          origin: "https://forum.other.org",
          apiKey: "n3w-k3y-n3w-k3y",
        },
      },
    );
  });

  it("defaults the API username and needs a key the first time", async () => {
    expect(await save(ids.admin, { apiUsername: "" })).toEqual({ ok: true });
    expect((await stored()).apiUsername).toBe("system");
    await db.delete(templeForums);
    expect(await save(ids.admin, { apiKey: "" })).toMatchObject({
      ok: false,
      message: "Enter the forum's API key.",
    });
  });

  it("refuses non-public addresses, bad names and bad keys with a reason", async () => {
    const privateHost = async () => [{ address: "10.0.0.8", family: 4 }];
    expect(
      await service(ids.admin, { lookup: privateHost }).save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    for (const extra of [
      { origin: "http://forum.example.org" },
      { origin: "https://127.0.0.1" },
      { apiUsername: "not valid!" },
      { apiUsername: "x".repeat(61) },
      { apiKey: "has spaces in it" },
      { apiKey: "k".repeat(513) },
      { origin: 5 },
      { apiUsername: 5 },
      { apiKey: 5 },
    ])
      expect(await save(ids.admin, extra)).toMatchObject({
        ok: false,
        code: "INVALID_REQUEST",
      });
    expect(await stored()).toBeUndefined();
  });

  it("is for administrators of this temple (or global ones), and fresh each time", async () => {
    for (const actor of [ids.member, ids.otherAdmin, ids.outsider])
      expect(await save(actor)).toMatchObject({
        ok: false,
        code: "NOT_AUTHORIZED",
      });
    expect(await stored()).toBeUndefined();
    expect(await save(ids.global)).toEqual({ ok: true });
    await db
      .update(templeMemberships)
      .set({ admin: false })
      .where(eq(templeMemberships.userId, ids.admin));
    expect(await save(ids.admin, { apiUsername: "again" })).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
  });

  it("reveals the connection only to those who may manage it", async () => {
    await save(ids.admin);
    for (const actor of [ids.member, ids.otherAdmin, ids.outsider, null])
      expect(await service(actor).read(ids.temple)).toBeNull();
    expect(await service(ids.global).read(ids.temple)).toMatchObject({
      settings: { origin: "https://forum.example.org" },
    });
    expect(await service(ids.otherAdmin).read(ids.other)).toEqual({
      settings: null,
    });
    expect(await service(ids.admin).read(createUuidV7())).toBeNull();
  });

  it("rejects malformed requests, switched accounts and unknown temples", async () => {
    const good = {
      version: 1,
      expectedActorId: ids.admin,
      templeId: ids.temple,
      origin: "https://forum.example.org",
      apiUsername: "system",
      apiKey: KEY,
    };
    const writer = service(ids.admin);
    for (const bad of [
      null,
      [],
      { ...good, version: 2 },
      { ...good, extra: 1 },
      { ...good, templeId: 7 },
      { ...good, expectedActorId: "nope" },
    ])
      expect(await writer.save(bad)).toMatchObject({
        ok: false,
        code: "INVALID_REQUEST",
      });
    expect(
      await writer.save({ ...good, expectedActorId: ids.member }),
    ).toMatchObject({ ok: false, code: "ACCOUNT_CHANGED" });
    expect(await service(null).save(good)).toMatchObject({
      ok: false,
      code: "NOT_AUTHENTICATED",
    });
    expect(
      await writer.save({ ...good, templeId: createUuidV7() }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("refuses to store keys when the server has no secret to protect them", async () => {
    const bare = service(ids.admin, { env: {} });
    expect(bare.canStoreKeys()).toBe(false);
    expect(
      await bare.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, code: "NOT_CONFIGURED" });
    expect(service(ids.admin).canStoreKeys()).toBe(true);
  });

  it("treats a temple route it cannot resolve as not found, and stamps the time by default", async () => {
    const plain = createSqlTempleForumService(db, async () => ids.admin, {
      env,
      lookup: publicHost,
      checkKey: async () => ({ ok: true }),
    });
    expect(
      await plain.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: "not a temple",
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await plain.read("not a temple")).toBeNull();
    const before = Date.now();
    expect(
      await plain.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toEqual({ ok: true });
    expect((await stored()).updatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("reports an unreachable database as unavailable", async () => {
    const broken = createSqlTempleForumService(
      {
        select: db.select.bind(db),
        insert: db.insert.bind(db),
        transaction: async () => {
          throw new Error("down");
        },
      } as never,
      async () => ids.admin,
      { env, lookup: publicHost, checkKey: async () => ({ ok: true }) },
    );
    expect(
      await broken.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    expect(await broken.read(ids.temple)).toBeNull();
  });

  it("looks the address up with the system resolver by default", async () => {
    const real = createSqlTempleForumService(db, async () => ids.admin, {
      env,
      checkKey: async () => ({ ok: true }),
    });
    expect(
      await real.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({
      ok: false,
      code: "INVALID_REQUEST",
      message: "That address could not be found.",
    });
  });

  it("saves only a key the forum accepts as an administrator's, and never asks again to keep one", async () => {
    const calls: unknown[][] = [];
    const checkKey = async (...args: unknown[]) => {
      calls.push(args);
      return args[2] === KEY
        ? ({ ok: true } as const)
        : ({ ok: false, message: "Not an administrator's key." } as const);
    };
    const checked = (apiKey: string, extra: Record<string, unknown> = {}) =>
      service(ids.admin, { checkKey }).save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey,
        ...extra,
      });
    expect(await checked("wrong-key-wrong-key")).toMatchObject({
      ok: false,
      message: "Not an administrator's key.",
    });
    expect(await stored()).toBeUndefined();
    expect(await checked(KEY)).toEqual({ ok: true });
    expect(calls.at(-1)).toEqual(["https://forum.example.org", "system", KEY]);
    const before = calls.length;
    expect(await checked("", { apiUsername: "bot" })).toEqual({ ok: true });
    expect(calls).toHaveLength(before);
  });

  it("will not connect the Magick.ly site forum as a temple's own", async () => {
    expect(
      await save(ids.global, { origin: "https://forums.magick.ly" }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(await stored()).toBeUndefined();
  });
});

describe("proving a key", () => {
  const respond = (status: number) =>
    (async () => new Response("{}", { status })) as unknown as typeof fetch;

  it("accepts a forum that serves its administrator pages and says why it refuses otherwise", async () => {
    const seen: [string, RequestInit][] = [];
    const ok = (async (url: string, init: RequestInit) => {
      seen.push([url, init]);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    expect(
      await checkForumAdminKey("https://forum.example.org", "system", KEY, ok),
    ).toEqual({ ok: true });
    expect(seen[0][0]).toBe(
      "https://forum.example.org/admin/users/list/active.json?page=0",
    );
    expect(seen[0][1]).toMatchObject({
      redirect: "error",
      headers: { "Api-Key": KEY, "Api-Username": "system" },
    });
    for (const status of [401, 403, 404, 500])
      expect(
        await checkForumAdminKey(
          "https://forum.example.org",
          "system",
          KEY,
          respond(status),
        ),
      ).toMatchObject({ ok: false });
    const unreachable = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    expect(
      await checkForumAdminKey(
        "https://forum.example.org",
        "system",
        KEY,
        unreachable,
      ),
    ).toEqual({ ok: false, message: "Could not reach that forum." });
  });
});

describe("disconnecting and loading", () => {
  it("removes the connection for administrators only", async () => {
    await save(ids.admin);
    const clear = (actor: string) =>
      service(actor).clear({
        version: 1,
        expectedActorId: actor,
        templeId: ids.temple,
      });
    expect(await clear(ids.member)).toMatchObject({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(await stored()).toBeDefined();
    expect(await clear(ids.admin)).toEqual({ ok: true });
    expect(await stored()).toBeUndefined();
    expect(await clear(ids.admin)).toEqual({ ok: true });
    expect(
      await service(ids.admin).clear({
        version: 1,
        expectedActorId: ids.admin,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("tells a missing connection from one whose key can no longer be read", async () => {
    expect(await loadTempleForumCredentials(db, ids.temple, env)).toEqual({
      kind: "none",
    });
    await save(ids.admin);
    expect(
      await loadTempleForumCredentials(db, ids.temple, {
        BETTER_AUTH_SECRET: "a-different-secret",
      }),
    ).toEqual({ kind: "unreadable" });
    // A row moved to another temple cannot be read either.
    expect(await loadTempleForumCredentials(db, ids.other, env)).toEqual({
      kind: "none",
    });
    await db
      .update(templeForums)
      .set({ forumOrigin: "https://127.0.0.1" })
      .where(eq(templeForums.templeId, ids.temple));
    expect(await loadTempleForumCredentials(db, ids.temple, env)).toEqual({
      kind: "unreadable",
    });
  });
});

describe("choosing what a sync talks to", () => {
  const target = (
    actorId: string,
    templeId = ids.temple,
    lookup = publicHost,
  ) => resolveForumSyncTarget(db, { actorId, templeId }, { env, lookup });

  it("uses the temple's own forum for its administrators and for global ones", async () => {
    await save(ids.admin);
    for (const actor of [ids.admin, ids.global])
      expect(await target(actor)).toEqual({
        kind: "own",
        credentials: {
          origin: "https://forum.example.org",
          apiUsername: "system",
          apiKey: KEY,
        },
      });
  });

  it("refuses everyone else, and a malformed request", async () => {
    await save(ids.admin);
    for (const actor of [ids.member, ids.otherAdmin, ids.outsider])
      expect(await target(actor)).toEqual({
        kind: "error",
        message: "Temple administrator access is required.",
      });
    expect(await target("nope")).toMatchObject({ kind: "error" });
    expect(await target(ids.admin, "not-a-temple")).toMatchObject({
      kind: "error",
      message: "The sync request is invalid.",
    });
  });

  it("falls back to the site forum only for global administrators", async () => {
    expect(await target(ids.global)).toEqual({ kind: "site" });
    expect(await target(ids.admin)).toEqual({
      kind: "error",
      message: "Add this temple's forum details first.",
    });
  });

  it("stops when the key cannot be read or the address no longer resolves publicly", async () => {
    await save(ids.admin);
    expect(
      await resolveForumSyncTarget(
        db,
        { actorId: ids.admin, templeId: ids.temple },
        { env: { BETTER_AUTH_SECRET: "rotated-away" }, lookup: publicHost },
      ),
    ).toMatchObject({
      kind: "error",
      message: expect.stringContaining("can no longer be read"),
    });
    const moved = async () => [{ address: "10.1.2.3", family: 4 }];
    expect(await target(ids.admin, ids.temple, moved)).toMatchObject({
      kind: "error",
      message: "Use the forum's public web address.",
    });
  });

  it("looks the address up with the system resolver by default", async () => {
    await save(ids.admin);
    expect(
      await resolveForumSyncTarget(
        db,
        { actorId: ids.admin, templeId: ids.temple },
        { env },
      ),
    ).toMatchObject({
      kind: "error",
      message: "That address could not be found.",
    });
  });
});
