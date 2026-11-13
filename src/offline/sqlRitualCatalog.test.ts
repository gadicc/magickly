import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { HALL_PRESETS } from "magick-components/gd/hall/presets";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  BUNDLE_FIXTURE_POLICY,
  BUNDLE_FIXTURE_TIME,
  bundleSchema,
  clearRitualBundleFixture,
  prepareRitualBundleFixture,
  type RitualBundleFixture,
  ritualBundleFixtureRecords,
  seedRitualBundleFixture,
} from "../../tests/ritualBundleFixtures";
import { templeMemberships } from "../db/schema/memberships";
import {
  ritualBundleAssets as assets,
  ritualBundles as bundles,
  ritualBundlePublicationIntents as intents,
} from "../db/schema/ritualBundles";
import {
  legacyRitualCompiledArchives,
  ritualCompiledArtifacts,
  ritualRevisions,
  rituals,
} from "../db/schema/rituals";
import { countHallRows } from "../doc/ritualHallCount";
import { type JsonValue, semanticFromJrt } from "../doc/semantic";
import { compileSemanticSource } from "../doc/semanticCompile";
import type { SqlRitualReadDatabase } from "../doc/sqlReads";
import { createUuidV7 } from "../lib/ids";
import {
  bundleTextSha256 as hash,
  ritualBundleRequestHash,
} from "./ritualBundlePublication";
import { createRitualRenderDescriptor } from "./ritualRenderDescriptor";
import { createSqlRitualBundleReader } from "./sqlRitualBundleReads";
import {
  createRitualCatalogHandler,
  createSqlRitualCatalogReader,
  type SqlRitualCatalogResult,
} from "./sqlRitualCatalog";

vi.mock("server-only", () => ({}));

const harness = await createMemoryPgliteHarness({ schema: bundleSchema });
const db = drizzle(harness.client, { schema: bundleSchema });
afterAll(() => harness.client.close());
afterEach(() => vi.restoreAllMocks());

const TRAP = `"type":"gdHall"`;
const OTHER_POLICY = "magickli-other-policy-v1";
function hall(index: number, caption: string): JsonValue {
  const row = structuredClone(HALL_PRESETS[index].hall) as unknown as {
    children: { type: string; text?: string }[];
  };
  for (const child of row.children)
    if (child.type === "caption") child.text = caption;
  return row as unknown as JsonValue;
}
function compiled(jrt: JsonValue) {
  const result = compileSemanticSource(JSON.stringify(semanticFromJrt(jrt)));
  if (!result) throw new Error("The ritual did not compile");
  return result.contentJson;
}
/** Two halls, and the marker in a caption, an attribute (`text`) and text. */
const hallJson = compiled({
  children: [
    { type: "title", text: TRAP },
    {
      type: "note",
      children: [hall(0, TRAP), { type: "text", value: TRAP }],
    },
    { type: "note", children: [hall(1, "Second")] },
  ],
});
/** A legacy archive's own spacing: the marker never matches it. */
const legacyJson = JSON.stringify(
  { children: [{ type: "note", children: [{ type: "gdHall" }] }] },
  null,
  2,
);

let fixture: RitualBundleFixture;
const disposals: (() => void)[] = [];
const ids: Record<string, string> = {};

type Parent = typeof rituals.$inferSelect;
async function publish(
  parent: Parent,
  contentJson: string,
  options: { policy?: string; nowMs?: number } = {},
) {
  const prepared = await prepareRitualBundleFixture({
    ritualId: parent.id,
    title: parent.title,
    contentJson,
    descriptor: createRitualRenderDescriptor(parent, {
      contentSha256: hash(contentJson),
    }),
  });
  disposals.push(() => prepared.dispose());
  const records = ritualBundleFixtureRecords(
    { ...fixture, parent, prepared } as RitualBundleFixture,
    { completed: true, nowMs: options.nowMs },
  );
  if (options.policy) {
    records.intent.publicationPolicyId = options.policy;
    records.intent.requestHash = ritualBundleRequestHash(records.intent);
  }
  await db.insert(intents).values(records.intent);
  if (records.rows.length) await db.insert(assets).values(records.rows);
  if (records.marker) await db.insert(bundles).values(records.marker);
}

/** A ritual with a current revision and its selected output. */
async function ritual(
  name: string,
  options: {
    scope?: "public" | "group" | "temple";
    templeId?: string;
    minGrade?: number;
    contentJson?: string;
    legacy?: boolean;
    published?: boolean;
  } = {},
) {
  const scope = options.scope ?? "temple";
  const contentJson = options.contentJson ?? hallJson;
  const [shell] = await db
    .insert(rituals)
    .values({
      id: createUuidV7(),
      creatorId: fixture.actors.creator,
      title: `Synthetic ${name}`,
      scope,
      groupId: scope === "group" ? fixture.groupId : null,
      templeId:
        scope === "temple" ? (options.templeId ?? fixture.templeId) : null,
      minGrade: scope === "temple" ? (options.minGrade ?? 0) : null,
      version: 3,
      updatedAt: new Date(BUNDLE_FIXTURE_TIME),
    })
    .returning();
  const source = `p ${name}`;
  const [revision] = await db
    .insert(ritualRevisions)
    .values({
      id: createUuidV7(),
      ritualId: shell.id,
      authorId: fixture.actors.creator,
      source,
      sourceSha256: hash(source),
      sourceFormat: "pug",
      sourceFormatVersion: "1",
      createdAt: new Date(BUNDLE_FIXTURE_TIME),
      updatedAt: new Date(BUNDLE_FIXTURE_TIME),
    })
    .returning();
  let artifactId: string | null = null;
  if (options.legacy)
    await db.insert(legacyRitualCompiledArchives).values({
      ritualId: shell.id,
      claimedRevisionId: revision.id,
      contentJson,
      contentSha256: hash(contentJson),
      serializationVersion: "json-stringify-utf8-v1",
      importedAt: new Date(BUNDLE_FIXTURE_TIME),
    });
  else {
    artifactId = createUuidV7();
    await db.insert(ritualCompiledArtifacts).values({
      id: artifactId,
      revisionId: revision.id,
      sourceSha256: revision.sourceSha256,
      compilerVersion: "synthetic-v1",
      outputFormat: "json-rich-text",
      outputFormatVersion: "1",
      transformations: [],
      contentJson,
      contentSha256: hash(contentJson),
      compiledAt: new Date(BUNDLE_FIXTURE_TIME),
    });
  }
  const [parent] = await db
    .update(rituals)
    .set({
      currentRevisionId: revision.id,
      currentCompiledArtifactId: artifactId,
    })
    .where(eq(rituals.id, shell.id))
    .returning();
  if (options.published !== false) await publish(parent, contentJson);
  ids[name] = parent.id;
  return parent;
}

beforeEach(async () => {
  for (const dispose of disposals.splice(0)) dispose();
  await clearRitualBundleFixture(db);
  fixture = await seedRitualBundleFixture(db, { images: false });
  disposals.push(fixture.dispose);
  ids.plain = fixture.parent.id;
  // The seeded ritual (no halls), published.
  const saved = ritualBundleFixtureRecords(fixture, { completed: true });
  await db.insert(intents).values(saved.intent);
  if (saved.marker) await db.insert(bundles).values(saved.marker);
  await ritual("halls");
  await ritual("legacy", { legacy: true, contentJson: legacyJson });
  await ritual("unpublished", { published: false });
  await ritual("gradeTwo", { minGrade: 2 });
  await ritual("otherTemple", { templeId: fixture.otherTempleId });
  await ritual("group", { scope: "group" });
  await ritual("public", { scope: "public" });
  // Published, then saved again: the bundle is for an older version.
  const stale = await ritual("stale");
  await db
    .update(rituals)
    .set({ version: stale.version + 1 })
    .where(eq(rituals.id, stale.id));
  // Published, then deleted.
  const deleted = await ritual("deleted");
  await db
    .update(rituals)
    .set({
      deletedAt: new Date(BUNDLE_FIXTURE_TIME),
      deletedById: fixture.actors.creator,
      purgeAfter: new Date(BUNDLE_FIXTURE_TIME),
    })
    .where(eq(rituals.id, deleted.id));
  // Published as a temple ritual, then moved to a group.
  const moved = await ritual("moved");
  await db
    .update(rituals)
    .set({
      scope: "group",
      groupId: fixture.groupId,
      templeId: null,
      minGrade: null,
    })
    .where(eq(rituals.id, moved.id));
  // An accepted publication, then a newer one under another policy.
  const mixed = await ritual("policyMix");
  await publish(mixed, hallJson, {
    policy: OTHER_POLICY,
    nowMs: BUNDLE_FIXTURE_TIME + 60_000,
  });
});
afterAll(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

type Actor = keyof RitualBundleFixture["actors"];
const catalog = (
  who: Actor | null,
  policies: readonly string[] = [BUNDLE_FIXTURE_POLICY],
  database: SqlRitualReadDatabase = db,
  deliveryAvailable?: boolean,
) =>
  createSqlRitualCatalogReader(
    database,
    async () => (who === null ? null : fixture.actors[who]),
    { acceptedPublicationPolicyIds: policies, deliveryAvailable },
  );
const names = (rows: SqlRitualCatalogResult) =>
  rows === null || rows === "unavailable"
    ? rows
    : Object.entries(ids)
        .filter(([, id]) => rows.some((row) => row.id === id))
        .map(([name]) => name)
        .sort();

describe("the temple ritual catalog", () => {
  it("lists readable, published temple rituals with their hall counts", async () => {
    const rows = await catalog("gradeZero")();
    expect(names(rows)).toEqual(["halls", "legacy", "plain", "policyMix"]);
    if (!Array.isArray(rows)) throw new Error("No catalog");
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(ids.halls)).toEqual({
      id: ids.halls,
      title: "Synthetic halls",
      templeSlug: "synthetic",
      templeName: "Synthetic temple",
      updatedAt: new Date(BUNDLE_FIXTURE_TIME),
      hallCount: 2,
    });
    expect(byId.get(ids.legacy)?.hallCount).toBe(1);
    expect(byId.get(ids.plain)?.hallCount).toBe(0);
  });

  it("counts in SQL exactly what a parse of the column counts", async () => {
    const rows = await catalog("gradeZero")();
    if (!Array.isArray(rows)) throw new Error("No catalog");
    const [row] = rows.filter(({ id }) => id === ids.halls);
    expect(hallJson).toContain(String.raw`\"type\":\"gdHall\"`);
    expect(row.hallCount).toBe(countHallRows(JSON.parse(hallJson)));
  });

  it("follows the caller's grade, temple and administration", async () => {
    expect(names(await catalog("gradeTwo")())).toEqual([
      "gradeTwo",
      "halls",
      "legacy",
      "plain",
      "policyMix",
    ]);
    expect(names(await catalog("otherAdmin")())).toEqual(["otherTemple"]);
    // Group membership and public rituals never reach the catalog.
    expect(names(await catalog("member")())).toEqual([]);
    expect(names(await catalog("outsider")())).toEqual([]);
  });

  it("lists only the temples the caller is a member of", async () => {
    // A global administrator reads every temple ritual, but has no tabs.
    expect(names(await catalog("global")())).toEqual([]);
    // The creator is a member at grade 0: the grade 2 ritual is as access says.
    const creator = names(await catalog("creator")());
    const manifest = await createSqlRitualBundleReader(
      db,
      async () => fixture.actors.creator,
      { acceptedPublicationPolicyIds: [BUNDLE_FIXTURE_POLICY] },
    ).getManifest({
      expectedActorId: fixture.actors.creator,
      ritualId: ids.gradeTwo,
    });
    expect(creator).toContain("halls");
    expect(Array.isArray(creator) && creator.includes("gradeTwo")).toBe(
      manifest !== null,
    );
  });

  it("lists exactly what the bundle reader would deliver", async () => {
    const parity = async (actors: Actor[]) => {
      const reader = (who: Actor) =>
        createSqlRitualBundleReader(db, async () => fixture.actors[who], {
          acceptedPublicationPolicyIds: [BUNDLE_FIXTURE_POLICY],
        });
      const parents = await db.select().from(rituals);
      for (const who of actors) {
        const memberships = await db
          .select()
          .from(templeMemberships)
          .where(eq(templeMemberships.userId, fixture.actors[who]));
        const listed = names(await catalog(who)());
        for (const [name, ritualId] of Object.entries(ids)) {
          const parent = parents.find(({ id }) => id === ritualId);
          const deliverable =
            (await reader(who).getManifest({
              expectedActorId: fixture.actors[who],
              ritualId,
            })) !== null;
          const member =
            parent?.scope === "temple" &&
            memberships.some(({ templeId }) => templeId === parent.templeId);
          expect([
            who,
            name,
            Array.isArray(listed) && listed.includes(name),
          ]).toEqual([who, name, deliverable && member]);
        }
      }
    };
    const actors = Object.keys(fixture.actors) as Actor[];
    await parity(actors);
    // The creator removed from the temple.
    await db
      .delete(templeMemberships)
      .where(
        and(
          eq(templeMemberships.userId, fixture.actors.creator),
          eq(templeMemberships.templeId, fixture.templeId),
        ),
      );
    expect(names(await catalog("creator")())).toEqual([]);
    await parity(["creator"]);
  });

  it("is unavailable, not empty, when publication cannot be decided", async () => {
    expect(await catalog("gradeZero", [])()).toBe("unavailable");
    expect(
      await catalog("gradeZero", [BUNDLE_FIXTURE_POLICY], db, false)(),
    ).toBe("unavailable");
    // Signed out still comes first.
    expect(await catalog(null, [])()).toBeNull();
    // An accepted policy is answered from what was published under it.
    expect(names(await catalog("gradeZero", [OTHER_POLICY])())).toEqual([
      "policyMix",
    ]);
    expect(await catalog("gradeZero", ["magickli-unused-policy-v1"])()).toEqual(
      [],
    );
  });

  it("validates its policies as the bundle reader does", () => {
    expect(() => catalog("gradeZero", ["Not a policy"])).toThrow(RangeError);
    expect(() =>
      catalog(
        "gradeZero",
        Array.from({ length: 33 }, (_, index) => `magickli-policy-${index}`),
      ),
    ).toThrow(RangeError);
  });

  it("reads and parses content only for the rituals it lists", async () => {
    const logged: { query: string; params: unknown[] }[] = [];
    const loggedDb = drizzle(harness.client, {
      schema: bundleSchema,
      logger: { logQuery: (query, params) => logged.push({ query, params }) },
    });
    const rows = await catalog("gradeZero", undefined, loggedDb)();
    if (!Array.isArray(rows)) throw new Error("No catalog");
    const listed = new Set(rows.map(({ id }) => id));
    const content = logged.filter(({ query }) =>
      query.includes('"content_json"'),
    );
    expect(content).toHaveLength(1);
    const asked = content[0].params.filter(
      (value) => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value),
    );
    expect(new Set(asked)).toEqual(listed);
  });

  it("answers null signed out or for an unknown user", async () => {
    expect(await catalog(null)()).toBeNull();
    expect(
      await createSqlRitualCatalogReader(db, async () => createUuidV7(), {
        acceptedPublicationPolicyIds: [BUNDLE_FIXTURE_POLICY],
      })(),
    ).toBeNull();
    expect(
      await createSqlRitualCatalogReader(db, async () => "not-a-user", {
        acceptedPublicationPolicyIds: [BUNDLE_FIXTURE_POLICY],
      })(),
    ).toBeNull();
  });

  it("reads in one read-only repeatable-read transaction", async () => {
    const transaction = vi.spyOn(db, "transaction");
    await catalog("gradeZero")();
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  });
});

describe("GET /api/rituals/catalog", () => {
  const url = "https://magick.test/api/rituals/catalog";
  const get = (handler: ReturnType<typeof createRitualCatalogHandler>) =>
    handler(new Request(url));

  it("returns the caller's catalog, never cached", async () => {
    const response = await get(
      createRitualCatalogHandler(catalog("gradeZero")),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("vary")).toBe("Cookie");
    const body = (await response.json()) as {
      rituals: { id: string; updatedAt: string }[];
    };
    expect(Object.keys(body)).toEqual(["rituals"]);
    expect(names(body.rituals as never)).toEqual([
      "halls",
      "legacy",
      "plain",
      "policyMix",
    ]);
    expect(body.rituals.find(({ id }) => id === ids.halls)).toEqual({
      id: ids.halls,
      title: "Synthetic halls",
      templeSlug: "synthetic",
      templeName: "Synthetic temple",
      updatedAt: new Date(BUNDLE_FIXTURE_TIME).toISOString(),
      hallCount: 2,
    });
  });

  it("answers 401 signed out", async () => {
    const response = await get(createRitualCatalogHandler(catalog(null)));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ error: "authentication-required" });
  });

  it("refuses other methods and query strings", async () => {
    const handler = createRitualCatalogHandler(catalog("gradeZero"));
    for (const request of [
      new Request(url, { method: "POST" }),
      new Request(`${url}?temple=synthetic`),
    ]) {
      const response = await handler(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid-request" });
    }
  });

  it("answers 503 when publication cannot be decided", async () => {
    for (const handler of [
      createRitualCatalogHandler(catalog("gradeZero", [])),
      createRitualCatalogHandler(
        catalog("gradeZero", [BUNDLE_FIXTURE_POLICY], db, false),
      ),
    ]) {
      const response = await get(handler);
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.json()).toEqual({
        error: "temporarily-unavailable",
      });
    }
  });

  it("hides failures behind a 503", async () => {
    const response = await get(
      createRitualCatalogHandler(async () => {
        throw new Error("sensitive SQL detail");
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ error: "temporarily-unavailable" });
  });
});
