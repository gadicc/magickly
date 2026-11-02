import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import {
  BUNDLE_FIXTURE_POLICY,
  BUNDLE_FIXTURE_TIME,
  bundleSchema,
  clearRitualBundleFixture,
  type RitualBundleFixture,
  ritualBundleFixtureRecords,
  seedRitualBundleFixture,
} from "../../tests/ritualBundleFixtures";
import { userGroupGrants } from "../db/schema/memberships";
import {
  ritualBundleAssets,
  ritualBundlePublicationIntents,
  ritualBundles,
} from "../db/schema/ritualBundles";
import { rituals } from "../db/schema/rituals";
import { readRitualBundleAsset } from "./readRitualBundleAsset";
import { bundleTextSha256 } from "./ritualBundlePublication";
import { parseRitualPermissionCheckResponse } from "./ritualCheckContract";
import { createRitualHttpHandlers } from "./ritualHttp";
import { createSqlRitualPermissionChecker } from "./sqlPermissionCheck";
import { createSqlRitualBundleReader } from "./sqlRitualBundleReads";

vi.mock("server-only", () => ({}));

const harness = await createMemoryPgliteHarness({ schema: bundleSchema });
const db = drizzle(harness.client, { schema: bundleSchema });
const ROUTE_ALIAS = "0123456789abcdef01234567";
let fixture: RitualBundleFixture;
let records: ReturnType<typeof ritualBundleFixtureRecords>;

beforeAll(async () => {
  await clearRitualBundleFixture(db);
  fixture = await seedRitualBundleFixture(db, { scope: "group" });
  records = ritualBundleFixtureRecords(fixture, { completed: true });
  await db.insert(ritualBundlePublicationIntents).values(records.intent);
  if (records.rows.length)
    await db.insert(ritualBundleAssets).values(records.rows);
  await db.insert(ritualBundles).values(records.marker!);
});

afterAll(async () => {
  fixture.dispose();
  await harness.client.close();
});

function services(actorId: string | null) {
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
    readAsset: (input, signal) =>
      readRitualBundleAsset(
        reader,
        {
          readAsset: async (asset) =>
            fixture.prepared.copyBytes(asset.assetKey),
        },
        input,
        { signal },
      ),
  });
}

it("delivers one current SQL permission and manifest envelope", async () => {
  const actorId = fixture.actors.creator;
  const body = {
    version: 1,
    requestId: "019947c5-abcd-7000-8000-000000000001",
    expectedActorId: actorId,
    ritualId: fixture.parent.id,
  };
  const response = await services(actorId).permission(
    new Request("https://synthetic.example/api/rituals/permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const delivery = await response.json();
  expect(delivery).toMatchObject({
    version: 1,
    requestId: body.requestId,
    ownerId: actorId,
    ritualId: fixture.parent.id,
    permission: {
      kind: "granted",
      ownerId: actorId,
      rendered: { kind: "available" },
    },
    bundle: {
      bundleId: records.intent.bundleId,
      manifestSha256: records.intent.manifestSha256,
    },
  });
  expect(delivery.bundle.manifestJson).toBe(records.intent.manifestJson);
});

it("echoes only an alias resolved to the requested canonical ritual", async () => {
  const actorId = fixture.actors.creator;
  const body = {
    version: 1,
    requestId: "019947c5-abcd-7000-8000-000000000002",
    expectedActorId: actorId,
    ritualId: fixture.parent.id,
  };
  const response = await services(actorId).permission(
    new Request("https://synthetic.example/api/rituals/permission", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Magickli-Ritual-Alias": ROUTE_ALIAS,
      },
      body: JSON.stringify(body),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ritualId: fixture.parent.id,
    routeAlias: ROUTE_ALIAS,
  });
});

it("does not renew an editor lease when access is revoked during manifest lookup", async () => {
  const actorId = fixture.actors.groupAdmin;
  const actor = async () => actorId;
  const grants = await db
    .select()
    .from(userGroupGrants)
    .where(eq(userGroupGrants.userId, actorId));
  const reader = createSqlRitualBundleReader(db, actor, {
    acceptedPublicationPolicyIds: [BUNDLE_FIXTURE_POLICY],
  });
  const handlers = createRitualHttpHandlers({
    resolveRouteAlias: async () => null,
    checkPermission: createSqlRitualPermissionChecker(db, actor, {
      now: () => BUNDLE_FIXTURE_TIME,
    }),
    getManifest: async (input) => {
      const manifest = await reader.getManifest(input);
      expect(manifest).not.toBeNull();
      await db
        .delete(userGroupGrants)
        .where(eq(userGroupGrants.userId, actorId));
      return manifest;
    },
    readAsset: async () => null,
  });
  try {
    const response = await handlers.permission(
      new Request("https://synthetic.example/api/rituals/permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          requestId: "019947c5-abcd-7000-8000-000000000003",
          expectedActorId: actorId,
          ritualId: fixture.parent.id,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      permission: { kind: "denied" },
      bundle: null,
    });
  } finally {
    await db.insert(userGroupGrants).values(grants);
  }
});

it("returns exact bytes only through a current SQL asset binding", async () => {
  const actorId = fixture.actors.creator;
  const row = records.rows[0];
  const path = `/api/rituals/assets/${fixture.parent.id}/${records.intent.bundleId}/${row.key}`;
  const response = await services(actorId).asset(
    new Request(`https://synthetic.example${path}`, {
      headers: { "X-Magickli-Expected-Actor": actorId },
    }),
    {
      expectedActorId: actorId,
      ritualId: fixture.parent.id,
      bundleId: records.intent.bundleId,
      assetKey: row.key,
    },
  );
  const expected = fixture.prepared.copyBytes(row.key)!;
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-content-sha256")).toBe(row.sha256);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(expected);

  const denied = await services(fixture.actors.outsider).asset(
    new Request(`https://synthetic.example${path}`, {
      headers: { "X-Magickli-Expected-Actor": fixture.actors.outsider },
    }),
    {
      expectedActorId: fixture.actors.outsider,
      ritualId: fixture.parent.id,
      bundleId: records.intent.bundleId,
      assetKey: row.key,
    },
  );
  expect(denied.status).toBe(404);
});

function permissionRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://synthetic.example/api/rituals/permission", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

async function v1AndV2(
  actorId: string | null,
  expectedActorId: string,
  headers: Record<string, string> = {},
) {
  const request = {
    version: 1 as const,
    requestId: "019947c5-abcd-7000-8000-000000000010",
    expectedActorId,
    ritualId: fixture.parent.id,
  };
  const handlers = services(actorId);
  const send = async (version: number) => {
    const response = await handlers.permission(
      permissionRequest(JSON.stringify({ ...request, version }), headers),
    );
    return {
      status: response.status,
      headers: [...response.headers],
      text: await response.text(),
    };
  };
  const v1 = await send(1);
  const v2 = await send(2);
  expect(v2.status).toBe(v1.status);
  expect(v2.headers).toEqual(v1.headers);
  const full = JSON.parse(v1.text);
  const check = JSON.parse(v2.text);
  expect(Object.keys(check)).toEqual(Object.keys(full));
  expect(v2.text).not.toContain("manifestJson");
  // Each check mints its own lease, so only the lease ID may differ.
  const withoutLease = (permission: { grant?: object }) =>
    permission.grant
      ? { ...permission, grant: { ...permission.grant, leaseId: null } }
      : permission;
  expect({
    ...check,
    version: 1,
    permission: withoutLease(check.permission),
    bundle: null,
  }).toEqual({
    ...full,
    permission: withoutLease(full.permission),
    bundle: null,
  });
  expect(check.version).toBe(2);
  expect(check.bundle).toEqual(
    full.bundle && {
      bundleId: full.bundle.bundleId,
      manifestSha256: full.bundle.manifestSha256,
    },
  );
  expect(
    parseRitualPermissionCheckResponse(
      request,
      check,
      { status: v2.status, sameOrigin: true, uncached: true },
      headers["X-Magickli-Ritual-Alias"] ?? null,
    ),
  ).toEqual({
    routeAlias: check.routeAlias,
    permission: check.permission,
    bundle: check.bundle,
  });
  return { v1: full, v2: check, v1Bytes: v1.text, v2Bytes: v2.text };
}

it("answers a check with the delivery's permission and bundle identity", async () => {
  const actors = fixture.actors;
  const granted = await v1AndV2(actors.creator, actors.creator);
  expect(granted.v2).toMatchObject({
    permission: { kind: "granted", rendered: { kind: "available" } },
    bundle: {
      bundleId: records.intent.bundleId,
      manifestSha256: records.intent.manifestSha256,
    },
  });
  // The largest fixture: images make its manifest the biggest here.
  expect(new TextEncoder().encode(granted.v2Bytes).byteLength).toBeLessThan(
    64 * 1024,
  );
  expect(granted.v2Bytes.length).toBeLessThan(granted.v1Bytes.length);
  expect(
    (
      await v1AndV2(actors.creator, actors.creator, {
        "X-Magickli-Ritual-Alias": ROUTE_ALIAS,
      })
    ).v2,
  ).toMatchObject({
    routeAlias: ROUTE_ALIAS,
    bundle: { bundleId: records.intent.bundleId },
  });
  expect((await v1AndV2(actors.member, actors.member)).v2).toMatchObject({
    permission: { kind: "granted", editor: null },
    bundle: { bundleId: records.intent.bundleId },
  });
  expect((await v1AndV2(actors.outsider, actors.outsider)).v2).toMatchObject({
    permission: { kind: "denied" },
    bundle: null,
  });
  expect((await v1AndV2(null, actors.creator)).v2).toMatchObject({
    permission: { kind: "authentication-required" },
    bundle: null,
  });
});

it("offers a check no bundle exactly when the delivery has none", async () => {
  const creator = fixture.actors.creator;
  const update = (values: Partial<typeof rituals.$inferInsert>) =>
    db.update(rituals).set(values).where(eq(rituals.id, fixture.parent.id));
  const unbundled = async () => {
    const { v1, v2 } = await v1AndV2(creator, creator);
    expect(v1.bundle).toBeNull();
    expect(v2.bundle).toBeNull();
    return v2.permission;
  };
  try {
    await update({ currentCompiledArtifactId: null });
    expect(await unbundled()).toMatchObject({
      kind: "granted",
      rendered: { kind: "temporarily-unavailable" },
    });
  } finally {
    await update({ currentCompiledArtifactId: fixture.artifact.id });
  }
  try {
    // Renamed without republication: the stored manifest's title is stale.
    await update({ title: "Synthetic renamed" });
    expect(await unbundled()).toMatchObject({
      kind: "granted",
      rendered: { kind: "available" },
    });
  } finally {
    await update({ title: fixture.parent.title });
  }
  const intent = eq(
    ritualBundlePublicationIntents.operationId,
    records.intent.operationId,
  );
  try {
    // Consistent with its stored hash, so only decoding can refuse it.
    const manifestJson = `${records.intent.manifestJson.slice(0, -1)},"extra":1}`;
    await db
      .update(ritualBundlePublicationIntents)
      .set({ manifestJson, manifestSha256: bundleTextSha256(manifestJson) })
      .where(intent);
    expect(await unbundled()).toMatchObject({
      kind: "granted",
      rendered: { kind: "available" },
    });
  } finally {
    await db
      .update(ritualBundlePublicationIntents)
      .set({
        manifestJson: records.intent.manifestJson,
        manifestSha256: records.intent.manifestSha256,
      })
      .where(intent);
  }
  // Every state was restored, so the bundle is offered again.
  expect((await v1AndV2(creator, creator)).v2.bundle).toEqual({
    bundleId: records.intent.bundleId,
    manifestSha256: records.intent.manifestSha256,
  });
});

it("rejects a malformed check exactly as a malformed delivery", async () => {
  const actorId = fixture.actors.creator;
  const check = {
    version: 2,
    requestId: "019947c5-abcd-7000-8000-000000000011",
    expectedActorId: actorId,
    ritualId: fixture.parent.id,
  };
  const reply = async (body: string, headers?: Record<string, string>) => {
    const response = await services(actorId).permission(
      permissionRequest(body, headers),
    );
    return [response.status, await response.text()];
  };
  const invalid = [400, '{"error":"invalid-request"}'];
  const { ritualId: _ritualId, ...missing } = check;
  for (const body of [
    { ...check, extra: 1 },
    missing,
    { ...check, ritualId: check.ritualId.toUpperCase() },
    { ...check, version: "2" },
    null,
    [],
    "2",
    2,
  ])
    expect(await reply(JSON.stringify(body))).toEqual(invalid);
  expect(
    await reply(JSON.stringify(check), {
      "X-Magickli-Ritual-Alias": "fedcba9876543210fedcba98",
    }),
  ).toEqual(invalid);
  // The size bound applies before the version is read.
  expect(await reply(JSON.stringify(check) + " ".repeat(4096))).toEqual([
    503,
    '{"error":"temporarily-unavailable"}',
  ]);
});
