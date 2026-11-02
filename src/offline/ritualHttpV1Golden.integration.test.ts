import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  BUNDLE_FIXTURE_POLICY,
  BUNDLE_FIXTURE_TIME,
  bundleSchema,
  clearRitualBundleFixture,
  type RitualBundleFixture,
  ritualBundleFixtureRecords,
  seedRitualBundleFixture,
} from "../../tests/ritualBundleFixtures";
import {
  ritualBundleAssets,
  ritualBundlePublicationIntents,
  ritualBundles,
} from "../db/schema/ritualBundles";
import { rituals } from "../db/schema/rituals";
import { createRitualHttpHandlers } from "./ritualHttp";
import golden from "./ritualHttpV1Golden.json";
import { createSqlRitualPermissionChecker } from "./sqlPermissionCheck";
import { createSqlRitualBundleReader } from "./sqlRitualBundleReads";

// Every identifier, including each minted lease ID, comes from this counter,
// so the fixture and the replies are the same bytes on every run.
const ids = vi.hoisted(() => {
  let next = 0;
  return {
    reset(value: number) {
      next = value;
    },
    create() {
      next += 1;
      return `01900000-0000-7000-8000-${next.toString(16).padStart(12, "0")}`;
    },
  };
});
vi.mock("../lib/ids", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/ids")>()),
  createUuidV7: ids.create,
}));
vi.mock("server-only", () => ({}));

const harness = await createMemoryPgliteHarness({ schema: bundleSchema });
const db = drizzle(harness.client, { schema: bundleSchema });
const ROUTE_ALIAS = "0123456789abcdef01234567";
const REQUEST_ID = "019947c5-abcd-7000-8000-0000000000a1";
// Lease IDs start here in every case, far from the fixture's own IDs.
const LEASE_BASE = 0xf0000;
let fixture: RitualBundleFixture;

beforeAll(async () => {
  ids.reset(0);
  await clearRitualBundleFixture(db);
  // Image-free, so the recorded manifest does not depend on the PNG encoder.
  fixture = await seedRitualBundleFixture(db, {
    scope: "group",
    images: false,
  });
  const records = ritualBundleFixtureRecords(fixture, { completed: true });
  await db.insert(ritualBundlePublicationIntents).values(records.intent);
  if (records.rows.length)
    await db.insert(ritualBundleAssets).values(records.rows);
  await db.insert(ritualBundles).values(records.marker!);
});

beforeEach(() => ids.reset(LEASE_BASE));

afterAll(async () => {
  fixture.dispose();
  await harness.client.close();
});

function handlers(actorId: string | null) {
  const actor = async () => actorId;
  const reader = createSqlRitualBundleReader(db, actor, {
    acceptedPublicationPolicyIds: [BUNDLE_FIXTURE_POLICY],
  });
  return createRitualHttpHandlers({
    resolveRouteAlias: async (alias) =>
      alias === ROUTE_ALIAS ? fixture.parent.id : null,
    checkPermission: createSqlRitualPermissionChecker(db, actor, {
      now: () => BUNDLE_FIXTURE_TIME,
    }),
    getManifest: reader.getManifest,
    readAsset: async () => null,
  });
}

function body(expectedActorId = fixture.actors.creator) {
  return JSON.stringify({
    version: 1,
    requestId: REQUEST_ID,
    expectedActorId,
    ritualId: fixture.parent.id,
  });
}

async function reply(
  actorId: string | null,
  text: string,
  headers: Record<string, string> = {},
) {
  const response = await handlers(actorId).permission(
    new Request("https://synthetic.example/api/rituals/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: text,
    }),
  );
  return {
    status: response.status,
    headers: [...response.headers],
    body: await response.text(),
  };
}

it("keeps a grant with its bundle byte for byte", async () => {
  expect(await reply(fixture.actors.creator, body())).toEqual(
    golden.grantWithBundle,
  );
});

it("keeps an echoed route alias byte for byte", async () => {
  expect(
    await reply(fixture.actors.creator, body(), {
      "X-Magickli-Ritual-Alias": ROUTE_ALIAS,
    }),
  ).toEqual(golden.routeAlias);
});

it("keeps a grant whose rendering is unavailable byte for byte", async () => {
  await db
    .update(rituals)
    .set({ currentCompiledArtifactId: null })
    .where(eq(rituals.id, fixture.parent.id));
  try {
    expect(await reply(fixture.actors.creator, body())).toEqual(
      golden.renderingUnavailable,
    );
  } finally {
    await db
      .update(rituals)
      .set({ currentCompiledArtifactId: fixture.artifact.id })
      .where(eq(rituals.id, fixture.parent.id));
  }
});

it("keeps a denial byte for byte", async () => {
  expect(
    await reply(fixture.actors.outsider, body(fixture.actors.outsider)),
  ).toEqual(golden.denied);
});

it("keeps authentication required byte for byte", async () => {
  expect(await reply(null, body())).toEqual(golden.authenticationRequired);
});

it("keeps invalid bodies and headers byte for byte", async () => {
  const actorId = fixture.actors.creator;
  const valid = JSON.parse(body());
  expect({
    extraKey: await reply(actorId, JSON.stringify({ ...valid, extra: 1 })),
    missingKey: await reply(
      actorId,
      JSON.stringify({ ...valid, ritualId: undefined }),
    ),
    unknownAlias: await reply(actorId, body(), {
      "X-Magickli-Ritual-Alias": "fedcba9876543210fedcba98",
    }),
    malformedJson: await reply(actorId, "{"),
  }).toEqual(golden.invalid);
});
