import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { and, eq, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import { createUuidV7 } from "../lib/ids";
import {
  createResearchGatewayCapture,
  inspectResearchGatewayCapture,
  type ResearchGatewayDispatchFence,
} from "./gatewayCapture";
import { projectResearchGatewayCandidate } from "./gatewayResponse";
import { gatewayResponseFixture } from "./gatewayResponse.fixture";
import {
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import {
  inspectResearchRequestArtifact,
  prepareResearchRequestArtifact,
  RESEARCH_ARTIFACT_RETENTION_MS,
} from "./requestArtifact";
import { artifactRequestFixture } from "./requestArtifact.fixture";
import {
  createSqlResearchAdmission,
  type ResearchAccountingScope,
  type ResearchAdmissionDatabase,
  type ResearchAdmissionTransaction,
} from "./sqlAdmission";
import {
  createSqlResearchArtifactPurger,
  lockResearchArtifacts,
  researchArtifactNamespace,
  validateResearchRequestRow,
} from "./sqlArtifacts";

vi.mock("server-only", () => ({}));
const h = await createMemoryPgliteHarness({ schema: { windows, permits } }),
  { db, client } = h;
beforeAll(() =>
  client.exec(
    readFileSync(
      new URL("../../drizzle/0023_lethal_hydra.sql", import.meta.url),
      "utf8",
    ),
  ),
);
afterAll(() => client.close());
afterEach(() => vi.restoreAllMocks());
const active = () => new AbortController().signal;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
let scope: ResearchAccountingScope,
  f: ReturnType<typeof artifactRequestFixture>,
  artifact: ReturnType<typeof prepareResearchRequestArtifact>,
  store: ReturnType<typeof createSqlResearchAdmission>,
  quote: { upperPico: number; quoteExpiresAtMs: number };
async function initialize(
  now = Date.now(),
  database: ResearchAdmissionDatabase = db,
) {
  f = artifactRequestFixture(now + 60000);
  const packet = inspectFrozenResearchModelRequest(f.request);
  scope = {
    windowId: createUuidV7(),
    approvalSha256: hash(createUuidV7()),
    actorId: packet.context.subject.user_id,
    corpusVersion: packet.context.corpus_version,
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
    beginsAtMs: now - 1000,
    expiresAtMs: now + 3599000,
    maxRequests: 3,
    perRequestPico: 20000000000,
    totalPico: 30000000000,
  };
  await db.insert(windows).values({
    id: scope.windowId,
    approvalSha256: scope.approvalSha256,
    actorId: scope.actorId,
    corpusVersion: scope.corpusVersion,
    model: scope.model,
    processorProfile: scope.processorProfile,
    beginsAt: new Date(scope.beginsAtMs),
    expiresAt: new Date(scope.expiresAtMs),
    maxRequests: scope.maxRequests,
    perRequestPico: scope.perRequestPico,
    totalPico: scope.totalPico,
  });
  artifact = prepareResearchRequestArtifact(
    f.request,
    scope.windowId,
    createUuidV7(),
  );
  quote = { upperPico: 10000000000, quoteExpiresAtMs: now + 50000 };
  store = createSqlResearchAdmission(database, scope);
}
beforeEach(() => initialize());
const windowRow = async () =>
  (await db.select().from(windows).where(eq(windows.id, scope.windowId)))[0];
const reserve = () => store.reserveWithRequest(artifact, quote, active());
const inspect = (id: string) => {
  const c = inspectResearchRequestArtifact(artifact).packet.context;
  return store.readRequest(
    id,
    c.subject.user_id,
    c.subject.session_id,
    active(),
  );
};
async function artifactRow(id: string) {
  return (
    await db
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.permitId, id), eq(artifacts.kind, "request")))
  )[0];
}
function reservation() {
  const p = inspectResearchRequestArtifact(artifact).packet;
  return {
    operationId: p.operation_id,
    actorId: p.context.subject.user_id,
    sessionId: p.context.subject.session_id,
    requestSha256: p.request_sha256,
    sourceContextSha256: p.source_context_sha256,
    ...quote,
  };
}
const ackLost: ResearchAdmissionDatabase = {
  transaction: async (work, config) => {
    await db.transaction(work, config);
    throw Error("Synthetic lost ACK");
  },
};

it("atomically stores exact request bytes, returns owned data, and replays without renewing retention or holding twice", async () => {
  const a = inspectResearchRequestArtifact(artifact),
    first = await reserve(),
    before = await artifactRow(first.permitId);
  expect(before).toMatchObject({
    packetJson: a.packet_json,
    packetSha256: a.packet_sha256,
    kind: "request",
  });
  expect(before.retainUntil.getTime() - before.jobCreatedAt.getTime()).toBe(
    RESEARCH_ARTIFACT_RETENTION_MS,
  );
  expect(before.storedAt).toEqual(before.jobCreatedAt);
  const other = createSqlResearchAdmission(db, scope);
  expect(await other.reserveWithRequest(artifact, quote, active())).toEqual(
    first,
  );
  expect(await artifactRow(first.permitId)).toEqual(before);
  expect(await windowRow()).toMatchObject({
    requestsUsed: 1,
    heldPico: quote.upperPico,
  });
  const view = (await inspect(first.permitId))!;
  expect(view.packet).toEqual(a.packet);
  view.packet.context.bindings.pop();
  expect((await inspect(first.permitId))!.packet.context.bindings).toHaveLength(
    3,
  );
});
it("rolls back permit, counters and sidecar together on late failure; exact lost-ACK replay recovers both", async () => {
  const rollback: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(async (tx) => {
        await work(tx);
        throw Error("Synthetic before COMMIT");
      }, config),
  };
  await expect(
    createSqlResearchAdmission(rollback, scope).reserveWithRequest(
      artifact,
      quote,
      active(),
    ),
  ).rejects.toThrow();
  expect(await windowRow()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
  expect(
    await db.select().from(permits).where(eq(permits.windowId, scope.windowId)),
  ).toEqual([]);
  await expect(
    createSqlResearchAdmission(ackLost, scope).reserveWithRequest(
      artifact,
      quote,
      active(),
    ),
  ).rejects.toThrow();
  const recovered = await reserve();
  expect(await inspect(recovered.permitId)).not.toBeNull();
  expect(await windowRow()).toMatchObject({
    requestsUsed: 1,
    heldPico: quote.upperPico,
  });
});
it("never upgrades a metadata-only permit or replays a different question under the same operation", async () => {
  const first = await store.reserve(reservation(), active());
  expect(await inspect(first.permitId)).toBeNull();
  await expect(reserve()).rejects.toThrow();
  await expect(
    store.beginDispatchWithRequest(first.permitId, artifact, active()),
  ).rejects.toThrow();
  expect(await windowRow()).toMatchObject({ requestsUsed: 1 });
});
it("rejects changed packet identity even when the provider body and context are identical", async () => {
  const first = await reserve(),
    a = inspectResearchRequestArtifact(artifact);
  const changedAnswer = (
    await import("./modelRequest")
  ).freezeResearchModelRequest(f.query, createUuidV7());
  const other = prepareResearchRequestArtifact(
    changedAnswer,
    scope.windowId,
    a.packet.operation_id,
  );
  expect(inspectResearchRequestArtifact(other).packet.request_sha256).toBe(
    a.packet.request_sha256,
  );
  await expect(
    store.reserveWithRequest(other, quote, active()),
  ).rejects.toThrow();
  await expect(
    store.beginDispatchWithRequest(first.permitId, other, active()),
  ).rejects.toThrow();
  expect((await artifactRow(first.permitId)).packetSha256).toBe(
    a.packet_sha256,
  );
});
it("validates startup scope and exact quotes before holding; caller fields cannot replace packet identity", async () => {
  for (const delta of [
    { model: "other" },
    { processorProfile: "other" },
    { corpusVersion: "b".repeat(64) },
    { actorId: createUuidV7() },
    { windowId: createUuidV7() },
  ])
    await expect(
      createSqlResearchAdmission(db, { ...scope, ...delta }).reserveWithRequest(
        artifact,
        quote,
        active(),
      ),
    ).rejects.toThrow();
  for (const q of [
    { ...quote, quoteExpiresAtMs: Date.now() + 120000 },
    { ...quote, operationId: createUuidV7() },
    { ...quote, upperPico: -1 },
  ])
    await expect(
      store.reserveWithRequest(artifact, q, active()),
    ).rejects.toThrow();
  expect(await windowRow()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
});
it("requires exact request object, store-local acknowledged claim, unexpired quote and one synchronous consumption", async () => {
  const first = await reserve(),
    claim = await store.beginDispatchWithRequest(
      first.permitId,
      artifact,
      active(),
    );
  expect(claim).not.toBeNull();
  const a = inspectResearchRequestArtifact(artifact),
    equal = prepareResearchRequestArtifact(
      f.request,
      scope.windowId,
      a.packet.operation_id,
    );
  expect(equal.revision).toBe(artifact.revision);
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, equal, active()),
  ).toThrow();
  expect(() =>
    createSqlResearchAdmission(db, scope).consumeRequestDispatchClaim(
      claim!,
      artifact,
      active(),
    ),
  ).toThrow();
  expect(
    store.consumeRequestDispatchClaim(claim!, artifact, active()).aborted,
  ).toBe(false);
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
  expect(
    await store.beginDispatchWithRequest(first.permitId, artifact, active()),
  ).toBeNull();
  expect(() =>
    store.consumeRequestDispatchClaim(
      { kind: "private_research_dispatch_claim" },
      artifact,
      active(),
    ),
  ).toThrow();
});
it("keeps accounting-only claims incapable of consuming request dispatch, including undefined input", async () => {
  const first = await reserve(),
    p = reservation(),
    claim = await store.beginDispatch(
      first.permitId,
      p.actorId,
      p.sessionId,
      active(),
    );
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, undefined as never, active()),
  ).toThrow();
});
it("never reclaims a dispatch after lost ACK and never issues a capability after a delayed ACK", async () => {
  const first = await reserve();
  await expect(
    createSqlResearchAdmission(ackLost, scope).beginDispatchWithRequest(
      first.permitId,
      artifact,
      active(),
    ),
  ).rejects.toThrow();
  expect(
    await store.beginDispatchWithRequest(first.permitId, artifact, active()),
  ).toBeNull();
  await initialize();
  const second = await reserve();
  const realNow = performance.now.bind(performance);
  let advance = 0;
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + advance);
  const delayed: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const r = await db.transaction(work, config);
      advance = 61000;
      return r;
    },
  };
  await expect(
    createSqlResearchAdmission(delayed, scope).beginDispatchWithRequest(
      second.permitId,
      artifact,
      active(),
    ),
  ).rejects.toThrow();
  expect(
    await store.beginDispatchWithRequest(second.permitId, artifact, active()),
  ).toBeNull();
});
it("rejects a once-valid claim whose monotonic quote expires before the future fetch", async () => {
  const first = await reserve(),
    claim = await store.beginDispatchWithRequest(
      first.permitId,
      artifact,
      active(),
    ),
    old = performance.now();
  vi.spyOn(performance, "now").mockReturnValue(old + 61000);
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
});
it("rejects foreign request reads and preserves immutable native SQL packet/retention guards", async () => {
  const first = await reserve(),
    p = reservation(),
    a = await artifactRow(first.permitId);
  for (const args of [
    [createUuidV7(), p.sessionId],
    [p.actorId, createUuidV7()],
  ])
    await expect(
      store.readRequest(first.permitId, args[0], args[1], active()),
    ).rejects.toThrow();
  await expect(
    store.readRequest(createUuidV7(), p.actorId, p.sessionId, active()),
  ).rejects.toThrow();
  for (const delta of [
    { packetJson: "changed", packetSha256: hash("changed") },
    { retainUntil: new Date(a.retainUntil.getTime() + 1) },
    { packetJson: null, purgedAt: new Date(a.retainUntil.getTime() + 1) },
    { packetJson: null, purgedAt: new Date() },
    { storedAt: new Date(a.storedAt.getTime() + 1) },
  ])
    await expect(
      db
        .update(artifacts)
        .set(delta)
        .where(eq(artifacts.permitId, first.permitId)),
    ).rejects.toThrow();
  await expect(
    db.delete(artifacts).where(eq(artifacts.permitId, first.permitId)),
  ).rejects.toThrow();
  await expect(
    client.exec("truncate public.chat_research_artifacts"),
  ).rejects.toThrow();
  await expect(
    db.insert(artifacts).values({
      ...a,
      kind: "result",
      packetJson: null,
      purgedAt: a.retainUntil,
    }),
  ).rejects.toThrow();
  for (const delta of [
    { packetSha256: "b".repeat(64) },
    { packetJson: "x".repeat(262145) },
    { retainUntil: new Date(a.retainUntil.getTime() + 1) },
    { storedAt: new Date(a.jobCreatedAt.getTime() - 1) },
  ])
    await expect(
      db.insert(artifacts).values({ ...a, ...delta, permitId: createUuidV7() }),
    ).rejects.toThrow();
  expect(await artifactRow(first.permitId)).toEqual(a);
});
/** Test-only historical fixture clock. Production has no clock injection; trigger expiry still uses actual DB time. */
function historicalDatabase(now: number): ResearchAdmissionDatabase {
  return {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                if (key === "select")
                  return (fields: object) =>
                    Object.keys(fields ?? {}).join() === "now"
                      ? { from: async () => [{ now: new Date(now) }] }
                      : target.select(fields as never);
                const v = Reflect.get(target, key);
                return typeof v === "function" ? v.bind(target) : v;
              },
            }) as ResearchAdmissionTransaction,
          ),
        config,
      ),
  };
}
it("expires independently of spending windows, purges request/result together without valid accounting, and never resurrects", async () => {
  const old = Date.now() - RESEARCH_ARTIFACT_RETENTION_MS - 10000;
  await initialize(old, historicalDatabase(old));
  const first = await reserve(),
    a = await artifactRow(first.permitId);
  await db.insert(artifacts).values({
    ...a,
    kind: "result",
    packetJson: "Synthetic result",
    packetSha256: hash("Synthetic result"),
    storedAt: new Date(old + 500),
  });
  store = createSqlResearchAdmission(db, scope);
  expect(await inspect(first.permitId)).toBeNull();
  // Cleanup does not depend on a valid billing fingerprint or source/session authorization.
  await db
    .update(windows)
    .set({ heldPico: 0 })
    .where(eq(windows.id, scope.windowId));
  const purge = createSqlResearchArtifactPurger(db);
  expect(await purge(1, active())).toEqual({ permits: 1, packets: 2 });
  const rows = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.permitId, first.permitId));
  expect(rows.every((r) => r.packetJson === null && r.purgedAt !== null)).toBe(
    true,
  );
  expect(rows[0].packetSha256).toBe(a.packetSha256);
  await expect(
    db
      .update(artifacts)
      .set({ packetJson: a.packetJson, purgedAt: null })
      .where(eq(artifacts.permitId, first.permitId)),
  ).rejects.toThrow();
  await db
    .update(windows)
    .set({ heldPico: quote.upperPico })
    .where(eq(windows.id, scope.windowId));
  expect(await inspect(first.permitId)).toBeNull();
  await expect(reserve()).rejects.toThrow();
  await expect(
    store.beginDispatchWithRequest(first.permitId, artifact, active()),
  ).rejects.toThrow();
  expect(await purge(1, active())).toEqual({ permits: 0, packets: 0 });
});
it("purge preserves live packets, aborts before commit and refuses unsupported namespace/savepoint handles", async () => {
  const first = await reserve(),
    before = await artifactRow(first.permitId),
    purge = createSqlResearchArtifactPurger(db);
  expect(await purge(10, active())).toEqual({ permits: 0, packets: 0 });
  for (const n of [0, 101, NaN, 1.5])
    await expect(purge(n, active())).rejects.toThrow();
  const stopped = new AbortController();
  stopped.abort();
  await expect(purge(1, stopped.signal)).rejects.toThrow();
  for (const schemaName of [
    "pg_temp",
    "information_schema",
    "other;drop",
    "public\n",
    "a".repeat(64),
  ])
    expect(() => researchArtifactNamespace({ schemaName })).toThrow();
  expect(() => researchArtifactNamespace({ extra: true } as never)).toThrow();
  expect(researchArtifactNamespace({})).toBe("public");
  expect(researchArtifactNamespace({ schemaName: "owned_research" })).toBe(
    "owned_research",
  );
  await expect(
    createSqlResearchArtifactPurger(db, {
      schemaName: "missing_owned_research",
    })(1, active()),
  ).rejects.toThrow();
  await db.transaction(async (tx) => {
    // @ts-expect-error root commits only, never a savepoint
    expect(() => createSqlResearchArtifactPurger(tx)).toThrow();
  });
  expect(await artifactRow(first.permitId)).toEqual(before);
});
it("rejects constraint-valid cross-binding drift in private request row inspection", async () => {
  const first = await reserve(),
    a = await artifactRow(first.permitId),
    p = (
      await db.select().from(permits).where(eq(permits.id, first.permitId))
    )[0];
  for (const delta of [
    { permitId: createUuidV7() },
    { kind: "result" as const },
    { jobCreatedAt: new Date(a.jobCreatedAt.getTime() + 1) },
    { storedAt: new Date(a.storedAt.getTime() + 1) },
    { retainUntil: new Date(a.retainUntil.getTime() + 1) },
    { packetJson: null },
    { purgedAt: new Date() },
  ])
    expect(() =>
      validateResearchRequestRow({ ...a, ...delta }, p, scope),
    ).toThrow();
  for (const delta of [
    { windowId: createUuidV7() },
    { operationId: createUuidV7() },
    { actorId: createUuidV7() },
    { sessionId: createUuidV7() },
    { requestSha256: "b".repeat(64) },
    { sourceContextSha256: "b".repeat(64) },
  ])
    expect(() =>
      validateResearchRequestRow(a, { ...p, ...delta }, scope),
    ).toThrow();
  for (const delta of [
    { model: "other" },
    { processorProfile: "other" },
    { corpusVersion: "b".repeat(64) },
  ])
    expect(() =>
      validateResearchRequestRow(a, p, { ...scope, ...delta }),
    ).toThrow();
});
it("never falls through to pooled temp storage when the durable artifact table is missing", async () => {
  await client.exec(
    "create schema missing_artifact_namespace; create temp table chat_research_artifacts (like public.chat_research_artifacts including all)",
  );
  try {
    await expect(
      db.transaction((tx) =>
        lockResearchArtifacts(tx, "missing_artifact_namespace"),
      ),
    ).rejects.toThrow();
  } finally {
    await client.exec(
      "drop table pg_temp.chat_research_artifacts; drop schema missing_artifact_namespace",
    );
  }
});
it("rolls back packet expiry atomically on lost-before-COMMIT cleanup and abort-after-write", async () => {
  const old = Date.now() - RESEARCH_ARTIFACT_RETENTION_MS - 10000;
  await initialize(old, historicalDatabase(old));
  const first = await reserve(),
    before = await artifactRow(first.permitId),
    controller = new AbortController();
  const cancelled: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(async (tx) => {
        const r = await work(tx);
        controller.abort();
        controller.signal.throwIfAborted();
        return r;
      }, config),
  };
  await expect(
    createSqlResearchArtifactPurger(cancelled)(1, controller.signal),
  ).rejects.toThrow();
  expect(await artifactRow(first.permitId)).toEqual(before);
  expect(await createSqlResearchArtifactPurger(db)(1, active())).toEqual({
    permits: 1,
    packets: 1,
  });
});
it("refuses unlogged artifact storage and skips work when another expiry worker owns the transaction lock", async () => {
  await client.exec(
    "create schema unlogged_artifact_namespace; create unlogged table unlogged_artifact_namespace.chat_research_artifacts (like public.chat_research_artifacts including all)",
  );
  try {
    await expect(
      db.transaction((tx) =>
        lockResearchArtifacts(tx, "unlogged_artifact_namespace"),
      ),
    ).rejects.toThrow();
  } finally {
    await client.exec(
      "drop table unlogged_artifact_namespace.chat_research_artifacts; drop schema unlogged_artifact_namespace",
    );
  }
  // PGlite has one backend; simulate only another worker's advisory-lock response, not SQL writes or expiry time.
  const busy: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                if (key === "select")
                  return (fields: object) =>
                    Object.keys(fields ?? {}).join() === "ok"
                      ? { from: async () => [{ ok: false }] }
                      : target.select(fields as never);
                const value = Reflect.get(target, key);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }) as ResearchAdmissionTransaction,
          ),
        config,
      ),
  };
  expect(await createSqlResearchArtifactPurger(busy)(1, active())).toEqual({
    permits: 0,
    packets: 0,
  });
});
it("settlement closes any unused request handoff even when a terminal transaction later fails", async () => {
  const first = await reserve(),
    claim = await store.beginDispatchWithRequest(
      first.permitId,
      artifact,
      active(),
    );
  await store.finish(
    claim!,
    { outcome: "failed", reportedPico: 0, responseSha256: null },
    active(),
  );
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
  await initialize();
  const second = await reserve(),
    other = await store.beginDispatchWithRequest(
      second.permitId,
      artifact,
      active(),
    ),
    aborted = new AbortController();
  aborted.abort();
  await expect(store.finish(other!, {}, aborted.signal)).rejects.toThrow();
  expect(() =>
    store.consumeRequestDispatchClaim(other!, artifact, active()),
  ).toThrow();
});

it("samples quote time only after the artifact lock is acquired, never stranding a hold on an expired quote", async () => {
  let delayedLocks = 0;
  const delayed: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                if (key === "execute")
                  return async (query: SQL) => {
                    const text = new PgDialect().sqlToQuery(query).sql,
                      result = await target.execute(query);
                    if (
                      text.includes(
                        'lock table "public"."chat_research_artifacts"',
                      )
                    ) {
                      delayedLocks++;
                      await new Promise((resolve) => setTimeout(resolve, 400));
                    }
                    return result;
                  };
                const value = Reflect.get(target, key);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }) as ResearchAdmissionTransaction,
          ),
        config,
      ),
  };
  quote = { ...quote, quoteExpiresAtMs: Date.now() + 250 };
  await expect(
    createSqlResearchAdmission(delayed, scope).reserveWithRequest(
      artifact,
      quote,
      active(),
    ),
  ).rejects.toThrow();
  expect(delayedLocks).toBe(1);
  expect(await windowRow()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
  expect(
    await db.select().from(permits).where(eq(permits.windowId, scope.windowId)),
  ).toEqual([]);
});

it("never revives a cancelled job or cancelled handoff by substituting a fresh signal", async () => {
  const first = await reserve(),
    original = new AbortController(),
    claim = await store.beginDispatchWithRequest(
      first.permitId,
      artifact,
      original.signal,
    );
  original.abort();
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
  expect(() =>
    store.consumeRequestDispatchClaim(claim!, artifact, active()),
  ).toThrow();
  await initialize();
  const second = await reserve(),
    other = await store.beginDispatchWithRequest(
      second.permitId,
      artifact,
      active(),
    ),
    cancelled = new AbortController();
  cancelled.abort();
  expect(() =>
    store.consumeRequestDispatchClaim(other!, artifact, cancelled.signal),
  ).toThrow();
  expect(() =>
    store.consumeRequestDispatchClaim(other!, artifact, active()),
  ).toThrow();
});

it("does not return retained request bytes after a delayed read COMMIT acknowledgment crosses expiry", async () => {
  const first = await reserve(),
    row = await artifactRow(first.permitId),
    p = reservation(),
    realNow = performance.now.bind(performance);
  let advance = 0;
  vi.spyOn(performance, "now").mockImplementation(() => realNow() + advance);
  const delayed: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const result = await historicalDatabase(
        row.retainUntil.getTime() - 1,
      ).transaction(work, config);
      advance = 100;
      return result;
    },
  };
  const reader = createSqlResearchAdmission(delayed, scope);
  expect(
    await reader.readRequest(first.permitId, p.actorId, p.sessionId, active()),
  ).toBeNull();
  expect((await artifactRow(first.permitId)).packetJson).not.toBeNull();
});

it("keeps original cancellation attached after a successful handoff with an additional caller signal", async () => {
  const first = await reserve(),
    original = new AbortController(),
    claim = await store.beginDispatchWithRequest(
      first.permitId,
      artifact,
      original.signal,
    ),
    network = store.consumeRequestDispatchClaim(claim!, artifact, active());
  expect(network.aborted).toBe(false);
  original.abort();
  expect(network.aborted).toBe(true);
});

it("captures once after an acknowledged SQL request marker and leaves completion pending atomic result storage", async () => {
  const receipt = await reserve(),
    claim = await store.beginDispatchWithRequest(
      receipt.permitId,
      artifact,
      active(),
    ),
    beforeDispatch = vi.fn<ResearchGatewayDispatchFence>(
      async (a, c, signal) => {
        expect(a).toBe(artifact);
        expect(c).toBe(claim);
        const p = reservation();
        expect(
          await store.inspect(receipt.permitId, p.actorId, p.sessionId, signal),
        ).toMatchObject({ state: "dispatching" });
      },
    ),
    requestFetch = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(gatewayResponseFixture()), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
  const capture = createResearchGatewayCapture({
    apiKey: "synthetic-capture-sql-integration-key",
    handoff: store,
    beforeDispatch,
    requestFetch,
  });
  const token = await capture(artifact, claim!, active()),
    data = inspectResearchGatewayCapture(token, artifact, claim!);
  expect(data.metadata).toMatchObject({
    attempted: true,
    complete: true,
    failure: null,
  });
  expect(
    projectResearchGatewayCandidate(data.raw, f.request).bound.request_revision,
  ).toBe(f.request.revision);
  expect(beforeDispatch).toHaveBeenCalledTimes(1);
  expect(requestFetch).toHaveBeenCalledTimes(1);
  const p = reservation();
  expect(
    await store.inspect(receipt.permitId, p.actorId, p.sessionId, active()),
  ).toMatchObject({ state: "dispatching", reportedPico: null });
  await expect(capture(artifact, claim!, active())).rejects.toThrow();
  expect(requestFetch).toHaveBeenCalledTimes(1);
  expect(await windowRow()).toMatchObject({
    requestsUsed: 1,
    heldPico: quote.upperPico,
  });
});
it("carries the SQL marker's original cancellation into capture and permits independent failed-state cleanup", async () => {
  const receipt = await reserve(),
    original = new AbortController(),
    claim = await store.beginDispatchWithRequest(
      receipt.permitId,
      artifact,
      original.signal,
    ),
    requestFetch = vi.fn<typeof fetch>(async (_url, init) => {
      original.abort();
      expect(init!.signal!.aborted).toBe(true);
      throw Error("Synthetic cancelled attempt");
    });
  const capture = createResearchGatewayCapture({
      apiKey: "synthetic-capture-sql-cancellation-key",
      handoff: store,
      beforeDispatch: async () => {},
      requestFetch,
    }),
    token = await capture(artifact, claim!, active());
  expect(
    inspectResearchGatewayCapture(token, artifact, claim!).metadata,
  ).toMatchObject({ attempted: true, complete: false, failure: "cancelled" });
  await store.finish(
    claim!,
    { outcome: "indeterminate", reportedPico: null, responseSha256: null },
    active(),
  );
  expect((await windowRow()).stopped).not.toBeNull();
  expect(await windowRow()).toMatchObject({
    requestsUsed: 1,
    heldPico: quote.upperPico,
  });
  expect(requestFetch).toHaveBeenCalledTimes(1);
});
