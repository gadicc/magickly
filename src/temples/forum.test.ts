import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import {
  createSecrets,
  envKeyring,
  SecretsKeyError,
  secretKeyFingerprint,
  staticKeyring,
} from "@gadicc/loom/secrets";
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
  type ForumKeySealer,
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
// Obviously synthetic keys: thirty-two copies of one byte.
const keyOf = (byte: number) => new Uint8Array(32).fill(byte);
const PURPOSE = "temple-forum.api-key";
const sealerUnder = (byte: number): ForumKeySealer =>
  createSecrets({ keys: staticKeyring({ 1: keyOf(byte) }) }).purpose(PURPOSE);
const forumKey = sealerUnder(1);
const otherKey = sealerUnder(2);
/** A server that was given no key at all, as a preview deployment is. */
const noKeys: ForumKeySealer = createSecrets({
  keys: envKeyring({ env: {} }),
}).purpose(PURPOSE);
/** A server holding a key other than the one whose fingerprint is recorded. */
const mismatched: ForumKeySealer = createSecrets({
  keys: staticKeyring({ 1: keyOf(1) }),
  expectedKeys: [
    {
      id: 1,
      fingerprint: await secretKeyFingerprint(keyOf(2)),
      state: "active",
    },
  ],
}).purpose(PURPOSE);
/** A server that refuses every operation, as Loom does for a contradictory environment. */
const refusing: ForumKeySealer = {
  seal: async () => {
    throw new SecretsKeyError("refused");
  },
  tryOpen: async () => {
    throw new SecretsKeyError("refused");
  },
  assertReady: async () => {
    throw new SecretsKeyError("refused");
  },
};
const publicHost = async () => [{ address: "93.184.216.34", family: 4 }];
const KEY = "0123456789abcdef0123456789abcdef";

const service = (
  actor: string | null,
  overrides: Parameters<typeof createSqlTempleForumService>[2] = {},
) =>
  createSqlTempleForumService(db, async () => actor, {
    forumKey,
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
    expect(row.apiKeyEncrypted).toMatch(/^ls1\.1\.[\w-]+\.[\w-]+$/);
    expect(row.apiKeyEncrypted).not.toContain(KEY);
    const read = await service(ids.admin).read(ids.temple);
    expect(read).toEqual({
      settings: {
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKeyHint: "cdef",
        keyReadable: true,
        updatedAt: row.updatedAt,
      },
    });
    expect(JSON.stringify(read)).not.toContain(KEY);
    const credentials = await loadTempleForumCredentials(
      db,
      ids.temple,
      forumKey,
    );
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
    // Nothing it is sealed to changed: the stored string is left alone.
    expect(await save(ids.admin, { apiKey: "" })).toEqual({ ok: true });
    expect((await stored()).apiKeyEncrypted).toBe(before);
    expect(
      await save(ids.admin, { apiKey: "", apiUsername: "  bot.user " }),
    ).toEqual({ ok: true });
    // The username is part of what the key is sealed to, so it is sealed again.
    const renamed = await stored();
    expect(renamed).toMatchObject({
      apiUsername: "bot.user",
      apiKeyHint: "cdef",
    });
    expect(renamed.apiKeyEncrypted).not.toBe(before);
    expect(
      await loadTempleForumCredentials(db, ids.temple, forumKey),
    ).toMatchObject({
      kind: "ready",
      credentials: { apiUsername: "bot.user", apiKey: KEY },
    });
    // The string sealed for the old name does not open under the new one.
    await db
      .update(templeForums)
      .set({ apiKeyEncrypted: before })
      .where(eq(templeForums.templeId, ids.temple));
    expect(await loadTempleForumCredentials(db, ids.temple, forumKey)).toEqual({
      kind: "unreadable",
    });
    await db
      .update(templeForums)
      .set({ apiKeyEncrypted: renamed.apiKeyEncrypted })
      .where(eq(templeForums.templeId, ids.temple));
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
    expect(
      await loadTempleForumCredentials(db, ids.temple, forumKey),
    ).toMatchObject({
      credentials: {
        origin: "https://forum.other.org",
        apiKey: "n3w-k3y-n3w-k3y",
      },
    });
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
    // Refused before the address is looked up or the key sent to it:
    // otherwise anyone signed in could have this server call a host of
    // their choosing.
    const lookup = vi.fn(publicHost);
    const checkKey = vi.fn(async () => ({ ok: true }) as const);
    const attempt = (actor: string, templeId = ids.temple) =>
      service(actor, { lookup, checkKey }).save({
        version: 1,
        expectedActorId: actor,
        templeId,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      });
    for (const actor of [ids.member, ids.otherAdmin, ids.outsider])
      expect(await attempt(actor)).toMatchObject({
        ok: false,
        code: "NOT_AUTHORIZED",
      });
    expect(await attempt(ids.admin, createUuidV7())).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(checkKey).not.toHaveBeenCalled();
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

  it("will not keep a saved key that no longer opens, and gives nothing of the connection back", async () => {
    const unreadable = { settings: { keyReadable: false } };
    const refusal = {
      ok: false,
      code: "INVALID_REQUEST",
      message:
        "The saved API key can no longer be read. Enter the API key again.",
    };
    await save(ids.admin);
    const healthy = await stored();
    const tamper = (change: Partial<typeof healthy>) =>
      db
        .update(templeForums)
        .set({ ...healthy, ...change })
        .where(eq(templeForums.templeId, ids.temple));

    // Someone with database access changes who the key acts as.
    await tamper({ apiUsername: "intruder" });
    // Exactly this: not the changed name, the address or the hint.
    expect(await service(ids.admin).read(ids.temple)).toEqual(unreadable);
    for (const apiUsername of ["intruder", "system"])
      expect(await save(ids.admin, { apiKey: "", apiUsername })).toEqual(
        refusal,
      );
    expect((await stored()).apiUsername).toBe("intruder");

    // Or where it is sent: another public host, kept or with a new name.
    await tamper({ forumOrigin: "https://forum.other.org" });
    expect(await service(ids.admin).read(ids.temple)).toEqual(unreadable);
    expect(await loadTempleForumCredentials(db, ids.temple, forumKey)).toEqual({
      kind: "unreadable",
    });
    for (const apiUsername of ["system", "bot"])
      expect(
        await save(ids.admin, {
          apiKey: "",
          origin: "https://forum.other.org",
          apiUsername,
        }),
      ).toEqual(refusal);
    expect(await stored()).toMatchObject({
      forumOrigin: "https://forum.other.org",
      apiKeyEncrypted: healthy.apiKeyEncrypted,
    });

    // Or swaps in the key sealed for another temple's forum.
    await db.insert(templeForums).values({
      ...healthy,
      templeId: ids.other,
      apiKeyEncrypted: await forumKey.seal("another-temples-key", {
        temple: ids.other,
        origin: healthy.forumOrigin,
        username: healthy.apiUsername,
      }),
    });
    const [theirs] = await db
      .select()
      .from(templeForums)
      .where(eq(templeForums.templeId, ids.other));
    await tamper({ apiKeyEncrypted: theirs.apiKeyEncrypted });
    expect(await service(ids.admin).read(ids.temple)).toEqual(unreadable);
    for (const apiUsername of ["system", "bot"])
      expect(await save(ids.admin, { apiKey: "", apiUsername })).toEqual(
        refusal,
      );

    // A value from before Loom, or under a key this server does not hold.
    await tamper({
      apiKeyEncrypted: "v1.0a1b2c3d.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(await service(ids.admin).read(ids.temple)).toEqual(unreadable);
    await tamper({});
    expect(
      await service(ids.admin, { forumKey: otherKey }).read(ids.temple),
    ).toEqual(unreadable);

    // Entering the key again is the way out.
    expect(await save(ids.admin)).toEqual({ ok: true });
    expect(await service(ids.admin).read(ids.temple)).toMatchObject({
      settings: { apiUsername: "system", keyReadable: true },
    });
  });

  it("takes the hint from the key, not from the stored copy of it", async () => {
    await save(ids.admin);
    await db
      .update(templeForums)
      .set({ apiKeyHint: "EVIL" })
      .where(eq(templeForums.templeId, ids.temple));
    expect(await save(ids.admin, { apiKey: "" })).toEqual({ ok: true });
    expect((await stored()).apiKeyHint).toBe("cdef");
    await db
      .update(templeForums)
      .set({ apiKeyHint: "EVIL" })
      .where(eq(templeForums.templeId, ids.temple));
    expect(await save(ids.admin, { apiKey: "", apiUsername: "bot" })).toEqual({
      ok: true,
    });
    expect((await stored()).apiKeyHint).toBe("cdef");
    // Nor does the page show the stored copy.
    await db
      .update(templeForums)
      .set({ apiKeyHint: "EVIL" })
      .where(eq(templeForums.templeId, ids.temple));
    expect(await service(ids.admin).read(ids.temple)).toMatchObject({
      settings: { keyReadable: true, apiKeyHint: "cdef" },
    });
  });

  it.each([
    ["has no key", noKeys],
    ["holds a key other than the recorded one", mismatched],
    ["refuses every operation", refusing],
  ])(
    "switches forum connections off when the server %s, before a key is sent anywhere",
    async (_, sealer) => {
      await save(ids.admin);
      const before = await stored();
      const checkKey = vi.fn(async () => ({ ok: true }) as const);
      const broken = service(ids.admin, { forumKey: sealer, checkKey });
      expect(await broken.canStoreKeys()).toBe(false);
      for (const extra of [
        {},
        { apiKey: "" },
        { apiKey: "", apiUsername: "bot" },
      ])
        expect(
          await broken.save({
            version: 1,
            expectedActorId: ids.admin,
            templeId: ids.temple,
            origin: "https://forum.example.org",
            apiUsername: "system",
            apiKey: KEY,
            ...extra,
          }),
        ).toMatchObject({ ok: false, code: "NOT_CONFIGURED" });
      expect(checkKey).not.toHaveBeenCalled();
      expect(await stored()).toEqual(before);
      // The page hides the form in this state; nothing is offered back either.
      expect(await broken.read(ids.temple)).toEqual({
        settings: { keyReadable: false },
      });
      // A sync says the server is at fault, not the administrator's key.
      expect(await loadTempleForumCredentials(db, ids.temple, sealer)).toEqual({
        kind: "unavailable",
      });
      expect(
        await resolveForumSyncTarget(
          db,
          { actorId: ids.admin, templeId: ids.temple },
          { forumKey: sealer, lookup: publicHost },
        ),
      ).toEqual({
        kind: "error",
        message:
          "This server cannot read forum keys at the moment. Try again later.",
      });
    },
  );

  it("stores keys on a server whose keys are ready", async () => {
    expect(await service(ids.admin).canStoreKeys()).toBe(true);
  });

  it("does not mistake a failure for an unreadable key or an unready server", async () => {
    await save(ids.admin);
    const failing = (method: keyof ForumKeySealer): ForumKeySealer => ({
      ...forumKey,
      [method]: async () => {
        throw new Error("down");
      },
    });
    expect(
      await service(ids.admin, { forumKey: failing("tryOpen") }).read(
        ids.temple,
      ),
    ).toBeNull();
    await expect(
      loadTempleForumCredentials(db, ids.temple, failing("tryOpen")),
    ).rejects.toThrow("down");
    const unsure = service(ids.admin, { forumKey: failing("assertReady") });
    await expect(unsure.canStoreKeys()).rejects.toThrow("down");
    expect(
      await unsure.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, code: "UNAVAILABLE" });
    // The key was accepted when the keys were ready and refused only at the
    // moment of sealing: still "not configured", and nothing is stored.
    await db.delete(templeForums);
    const late = service(ids.admin, {
      forumKey: { ...forumKey, seal: refusing.seal },
    });
    expect(
      await late.save({
        version: 1,
        expectedActorId: ids.admin,
        templeId: ids.temple,
        origin: "https://forum.example.org",
        apiUsername: "system",
        apiKey: KEY,
      }),
    ).toMatchObject({ ok: false, code: "NOT_CONFIGURED" });
    expect(await stored()).toBeUndefined();
  });

  it("uses the application's own keys unless given others", async () => {
    const own = createSqlTempleForumService(db, async () => ids.admin);
    expect(await own.read(ids.temple)).toEqual({ settings: null });
    expect(await loadTempleForumCredentials(db, ids.temple)).toEqual({
      kind: "none",
    });
  });

  it("treats a temple route it cannot resolve as not found, and stamps the time by default", async () => {
    const plain = createSqlTempleForumService(db, async () => ids.admin, {
      forumKey,
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
      {
        forumKey,
        lookup: publicHost,
        checkKey: async () => ({ ok: true }),
      },
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
      forumKey,
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
    expect(await loadTempleForumCredentials(db, ids.temple, forumKey)).toEqual({
      kind: "none",
    });
    await save(ids.admin);
    expect(await loadTempleForumCredentials(db, ids.temple, otherKey)).toEqual({
      kind: "unreadable",
    });
    expect(await loadTempleForumCredentials(db, ids.other, forumKey)).toEqual({
      kind: "none",
    });
    // A row copied to another temple cannot be read there.
    const { templeId: _, ...copied } = await stored();
    await db.insert(templeForums).values({ templeId: ids.other, ...copied });
    expect(await loadTempleForumCredentials(db, ids.other, forumKey)).toEqual({
      kind: "unreadable",
    });
    // An address that is not a forum's is unreadable whatever the key says.
    await db
      .update(templeForums)
      .set({ forumOrigin: "https://127.0.0.1" })
      .where(eq(templeForums.templeId, ids.temple));
    expect(await loadTempleForumCredentials(db, ids.temple, forumKey)).toEqual({
      kind: "unreadable",
    });
    expect(await loadTempleForumCredentials(db, ids.temple, noKeys)).toEqual({
      kind: "unreadable",
    });
  });
});

describe("choosing what a sync talks to", () => {
  const target = (
    actorId: string,
    templeId = ids.temple,
    lookup = publicHost,
  ) => resolveForumSyncTarget(db, { actorId, templeId }, { forumKey, lookup });

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
        { forumKey: otherKey, lookup: publicHost },
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
        { forumKey },
      ),
    ).toMatchObject({
      kind: "error",
      message: "That address could not be found.",
    });
  });
});
