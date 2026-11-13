/** Synthetic RAM PostgreSQL controls. No schedule, real operator, book material or service connection. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
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
import { chatResearchMaintenance as maintenance } from "../db/schema/chatResearchMaintenance";
import { createUuidV7 } from "../lib/ids";
import {
  prepareResearchMaintenanceTarget,
  RESEARCH_MAINTENANCE_ERROR,
  type ResearchMaintenanceTargetInput,
} from "./maintenanceTarget";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";
import type {
  ResearchAccountingScope,
  ResearchAdmissionDatabase,
} from "./sqlAdmission";
import { createSqlResearchArtifactPurger } from "./sqlArtifacts";
import {
  createSqlResearchMaintenance,
  type ResearchMaintenanceRun,
} from "./sqlMaintenance";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
  schema: { windows, permits },
});
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const active = () => new AbortController().signal;
beforeAll(async () => {
  for (const file of [
    "0023_lethal_hydra.sql",
    "0024_chat_research_maintenance.sql",
  ])
    await client.exec(
      readFileSync(new URL(`../../drizzle/${file}`, import.meta.url), "utf8"),
    );
});
afterAll(() => client.close());
const controllers: ReturnType<typeof createSqlResearchMaintenance>[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const c of controllers.splice(0)) await c.release().catch(() => {});
});
let input: ResearchMaintenanceTargetInput, scope: ResearchAccountingScope;
async function fixture(closed = false) {
  const now = Date.now(),
    [{ oid }] = (
      await client.query<{ oid: number }>(
        `select 'public.chat_research_artifacts'::regclass::oid::bigint as oid`,
      )
    ).rows;
  scope = {
    windowId: createUuidV7(),
    approvalSha256: sha(createUuidV7()),
    actorId: createUuidV7(),
    corpusVersion: "a".repeat(64),
    model: "synthetic-maintenance",
    processorProfile: "synthetic-profile",
    beginsAtMs: now - 60000,
    expiresAtMs: closed ? now - 1000 : now + 3600000,
    maxRequests: 10,
    perRequestPico: 100,
    totalPico: 1000,
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
  input = {
    scope,
    maintenanceSchema: "public",
    profileSha256: sha(createUuidV7()),
    artifactTableOid: Number(oid),
  };
  const t = prepareResearchMaintenanceTarget(input);
  await db.insert(maintenance).values({
    profileSha256: t.profileSha256,
    targetSha256: t.targetSha256,
    artifactSchema: t.storage.schemaName,
    artifactTableOid: t.artifactTableOid,
    publicationCutoff: new Date(t.publicationCutoffMs),
    coverageThrough: new Date(t.coverageThroughMs),
  });
  return t;
}
beforeEach(async () => {
  // RAM fixture reset only: restore both native no-truncate guards before every actual test.
  await client.exec(
    `alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance disable trigger chat_research_maintenance_delete`,
  );
  try {
    await client.exec(
      `truncate table public.chat_research_maintenance,public.chat_research_artifacts,public.chat_research_permits,public.chat_research_windows`,
    );
  } finally {
    await client.exec(
      `alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance enable trigger chat_research_maintenance_delete`,
    );
  }
  await fixture();
});

function controller(database: ResearchAdmissionDatabase = db, value = input) {
  const c = createSqlResearchMaintenance(database, value);
  controllers.push(c);
  return c;
}
async function rows() {
  return (
    await db
      .select()
      .from(maintenance)
      .where(eq(maintenance.profileSha256, input.profileSha256))
  )[0];
}
async function payload(expired = false) {
  const at =
      Date.now() - 10000 - (expired ? RESEARCH_ARTIFACT_RETENTION_MS : 0),
    permitId = createUuidV7();
  await db.insert(permits).values({
    id: permitId,
    windowId: scope.windowId,
    operationId: createUuidV7(),
    actorId: scope.actorId,
    sessionId: createUuidV7(),
    descriptorSha256: "b".repeat(64),
    requestSha256: sha("{}"),
    sourceContextSha256: "c".repeat(64),
    upperPico: 1,
    quoteExpiresAt: new Date(at + 30000),
    reservedAt: new Date(at),
    state: "reserved",
  });
  for (const kind of ["request", "result"] as const)
    await db.insert(artifacts).values({
      permitId,
      kind,
      packetJson: "{}",
      packetSha256: sha("{}"),
      jobCreatedAt: new Date(at),
      storedAt: new Date(at + 1),
      retainUntil: new Date(at + RESEARCH_ARTIFACT_RETENTION_MS),
    });
  return permitId;
}
it("commits started before packet work, fences completion with native state, and preserves spending", async () => {
  const c = controller(),
    before = (
      await db.select().from(windows).where(eq(windows.id, scope.windowId))
    )[0],
    claim = await c.begin(active());
  expect(claim).not.toBeNull();
  expect(await rows()).toMatchObject({
    state: "started",
    revision: 2,
    observedAt: null,
    expiredPackets: null,
  });
  const result = await c.finish(claim!, { permits: 0, packets: 0 }, active());
  expect(result).toMatchObject({
    state: "healthy",
    revision: 3,
    fresh: true,
    expired_packets: 0,
    unpurged_packets: 0,
  });
  expect(
    (await db.select().from(windows).where(eq(windows.id, scope.windowId)))[0],
  ).toEqual(before);
  await expect(
    c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await c.release();
});
it("a second controller on the same backend cannot re-enter or unlock the first target's session lock", async () => {
  const first = controller(),
    claim = await first.begin(active()),
    second = controller();
  expect(await second.begin(active())).toBeNull();
  await second.release();
  expect(
    await first.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).toMatchObject({ state: "healthy" });
  await first.release();
  const next = controller(),
    newClaim = await next.begin(active());
  expect(newClaim).not.toBeNull();
  expect((await rows()).revision).toBe(4);
});
it("native counts override a caller's empty/healthy implication and total live payloads prevent closure", async () => {
  await payload(false);
  await db
    .update(windows)
    .set({ stopped: new Date() })
    .where(eq(windows.id, scope.windowId));
  const c = controller(),
    claim = await c.begin(active()),
    result = await c.finish(claim!, { permits: 0, packets: 0 }, active());
  expect(result).toMatchObject({
    state: "healthy",
    expired_packets: 0,
    unpurged_packets: 2,
  });
  expect(result.latest_retain_until_ms).not.toBeNull();
});
it("reports a remaining expired backlog and closes only after all payloads are purged behind closed publication", async () => {
  await payload(true);
  await db
    .update(windows)
    .set({ stopped: new Date() })
    .where(eq(windows.id, scope.windowId));
  const first = controller(),
    claim = await first.begin(active());
  expect(
    await first.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).toMatchObject({
    state: "pending",
    expired_packets: 2,
    unpurged_packets: 2,
    fresh: false,
  });
  await first.release();
  const next = controller(),
    nextClaim = await next.begin(active()),
    removed = await createSqlResearchArtifactPurger(db)(100, active());
  expect(await next.finish(nextClaim!, removed, active())).toMatchObject({
    state: "closed",
    unpurged_packets: 0,
    fresh: false,
  });
  await next.release();
  expect(await controller().begin(active())).toBeNull();
});
it("closes an expired empty publication but never a live empty one", async () => {
  await db
    .update(windows)
    .set({ stopped: new Date() })
    .where(eq(windows.id, scope.windowId));
  await fixture(true);
  const c = controller(),
    claim = await c.begin(active());
  expect(
    await c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).toMatchObject({ state: "closed", unpurged_packets: 0 });
});
it("a live packet beyond minimum coverage makes the heartbeat pending despite no expired backlog", async () => {
  const at = scope.expiresAtMs + 1,
    permitId = createUuidV7();
  await db.insert(permits).values({
    id: permitId,
    windowId: scope.windowId,
    operationId: createUuidV7(),
    actorId: scope.actorId,
    sessionId: createUuidV7(),
    descriptorSha256: "b".repeat(64),
    requestSha256: sha("{}"),
    sourceContextSha256: "c".repeat(64),
    upperPico: 1,
    quoteExpiresAt: new Date(at + 30000),
    reservedAt: new Date(at),
    state: "reserved",
  });
  await db.insert(artifacts).values({
    permitId,
    kind: "request",
    packetJson: "{}",
    packetSha256: sha("{}"),
    jobCreatedAt: new Date(at),
    storedAt: new Date(at),
    retainUntil: new Date(at + RESEARCH_ARTIFACT_RETENTION_MS),
  });
  const c = controller(),
    claim = await c.begin(active());
  expect(
    await c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).toMatchObject({
    state: "pending",
    expired_packets: 0,
    unpurged_packets: 1,
    fresh: false,
  });
});
it("records failure without restoring the previous healthy observation", async () => {
  const c = controller(),
    claim = await c.begin(active());
  await c.fail(claim!, active());
  expect(await c.inspect(active())).toMatchObject({
    state: "failed",
    revision: 3,
    fresh: false,
    observed_at_ms: null,
  });
  await expect(
    c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
});
it("does not invent a profile, adopt missing state or accept changed target/scope", async () => {
  for (const change of [
    { profileSha256: "f".repeat(64) },
    { artifactTableOid: input.artifactTableOid + 1 },
    { scope: { ...scope, totalPico: scope.totalPico + 1 } },
  ]) {
    const c = controller(db, { ...input, ...change });
    await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
    await c.release();
  }
  expect((await rows()).state).toBe("idle");
});
it("rejects copied/foreign run identities, malformed counts, repeats and caller cancellation", async () => {
  const c = controller(),
    claim = await c.begin(active());
  for (const handle of [
    { ...claim! },
    { kind: "private_research_maintenance_run" },
  ])
    await expect(
      c.finish(
        handle as ResearchMaintenanceRun,
        { permits: 0, packets: 0 },
        active(),
      ),
    ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  for (const removed of [
    { permits: -1, packets: 0 },
    { permits: 0, packets: 201 },
    { permits: 0, packets: 0, extra: 1 },
  ])
    await expect(c.finish(claim!, removed, active())).rejects.toThrow(
      RESEARCH_MAINTENANCE_ERROR,
    );
  await expect(
    c.finish(claim!, { permits: 0, packets: 0 }, AbortSignal.abort()),
  ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect((await rows()).state).toBe("started");
});
it("refuses root savepoint handles and ignored transaction mode", async () => {
  await db.transaction(async (tx) => {
    expect(() =>
      createSqlResearchMaintenance(
        tx as unknown as ResearchAdmissionDatabase,
        input,
      ),
    ).toThrow(RESEARCH_MAINTENANCE_ERROR);
  });
  const wrong: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(work, { ...config, accessMode: "read only" }),
  };
  await expect(controller(wrong).begin(active())).rejects.toThrow(
    RESEARCH_MAINTENANCE_ERROR,
  );
});
it("a lost started ACK publishes no run handle and recovery requires the target lock", async () => {
  let calls = 0;
  const lost: ResearchAdmissionDatabase = {
      transaction: async (work, config) => {
        const value = await db.transaction(work, config);
        if (++calls === 2) throw Error("Synthetic private driver failure");
        return value;
      },
    },
    c = controller(lost);
  await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect((await rows()).state).toBe("started");
  await c.release();
  const next = controller(),
    claim = await next.begin(active());
  expect(claim).not.toBeNull();
  expect((await rows()).revision).toBe(3);
});
it("a lost final ACK is durable data, never a reason to rerun cleanup or overwrite it with failed", async () => {
  let lose = false;
  const lost: ResearchAdmissionDatabase = {
      transaction: async (work, config) => {
        const value = await db.transaction(work, config);
        if (lose) {
          lose = false;
          throw Error("Synthetic private ACK failure");
        }
        return value;
      },
    },
    c = controller(lost),
    claim = await c.begin(active());
  lose = true;
  await expect(
    c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect(await controller().inspect(active())).toMatchObject({
    state: "healthy",
    revision: 3,
    fresh: true,
  });
  await expect(c.fail(claim!, active())).rejects.toThrow(
    RESEARCH_MAINTENANCE_ERROR,
  );
  expect((await rows()).state).toBe("healthy");
});
it("a heartbeat rollback cannot erase the separately committed session lock nonce", async () => {
  // Removing the revision guard is an intentionally broken RAM-only migration fixture.
  await client.exec(
    `alter table public.chat_research_maintenance disable trigger chat_research_maintenance_change`,
  );
  const c = controller();
  try {
    await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
    expect((await rows()).state).toBe("idle");
    await c.release();
  } finally {
    await client.exec(
      `alter table public.chat_research_maintenance enable trigger chat_research_maintenance_change`,
    );
  }
  const next = controller();
  expect(await next.begin(active())).not.toBeNull();
});
it("native guards reject direct mutation/deletion and NULL-filled terminal states", async () => {
  await expect(
    db
      .delete(maintenance)
      .where(eq(maintenance.profileSha256, input.profileSha256)),
  ).rejects.toThrow();
  await expect(
    db
      .update(maintenance)
      .set({ state: "healthy" })
      .where(eq(maintenance.profileSha256, input.profileSha256)),
  ).rejects.toThrow();
  await client.exec(
    `create temporary table maintenance_shape (like public.chat_research_maintenance including all)`,
  );
  const t = prepareResearchMaintenanceTarget(input);
  await expect(
    client.query(
      `insert into maintenance_shape(profile_sha256,target_sha256,artifact_schema,artifact_table_oid,publication_cutoff,coverage_through,state) values($1,$2,'public',$3,$4,$5,'healthy')`,
      [
        t.profileSha256,
        t.targetSha256,
        t.artifactTableOid,
        new Date(t.publicationCutoffMs).toISOString(),
        new Date(t.coverageThroughMs).toISOString(),
      ],
    ),
  ).rejects.toThrow();
  await client.exec(`drop table maintenance_shape`);
});

it("another existing open window prevents stopping this physical target even when this profile's window is closed", async () => {
  await fixture(true);
  const c = controller(),
    claim = await c.begin(active());
  expect(
    await c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).toMatchObject({ state: "healthy", unpurged_packets: 0 });
});

it("teardown before begin resumes prevents acquisition or claim publication", async () => {
  const c = controller(),
    pending = c.begin(active()),
    refused = expect(pending).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await c.release();
  await refused;
  expect((await rows()).state).toBe("idle");
  const next = controller();
  expect(await next.begin(active())).not.toBeNull();
});
it("teardown drains a deferred native started ACK and never publishes the resulting claim", async () => {
  let count = 0,
    ack!: () => void,
    reached!: () => void;
  const atAck = new Promise<void>((r) => {
      reached = r;
    }),
    database: ResearchAdmissionDatabase = {
      transaction: async (work, config) => {
        const value = await db.transaction(work, config);
        if (++count === 2) {
          reached();
          await new Promise<void>((r) => {
            ack = r;
          });
        }
        return value;
      },
    },
    c = controller(database),
    pending = c.begin(active()),
    refused = expect(pending).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await atAck;
  expect((await rows()).state).toBe("started");
  let done = false;
  const release = c.release().then(() => {
    done = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(done).toBe(false);
  ack();
  await release;
  await refused;
  const next = controller();
  expect(await next.begin(active())).not.toBeNull();
});
it("read-only inspection refuses a recreated ordinary artifact table instead of inheriting old healthy metadata", async () => {
  const c = controller(),
    claim = await c.begin(active());
  await c.finish(claim!, { permits: 0, packets: 0 }, active());
  await c.release();
  await client.exec(
    `alter table public.chat_research_artifacts rename to replaced_artifacts; create table public.chat_research_artifacts (like public.replaced_artifacts including all)`,
  );
  try {
    await expect(controller().inspect(active())).rejects.toThrow(
      RESEARCH_MAINTENANCE_ERROR,
    );
  } finally {
    await client.exec(
      `drop table public.chat_research_artifacts; alter table public.replaced_artifacts rename to chat_research_artifacts`,
    );
  }
});
it("a rolled-back acquisition nonce cannot be mistaken for confirmed session teardown", async () => {
  let first = true;
  const database: ResearchAdmissionDatabase = {
      transaction: (work, config) =>
        db.transaction(async (tx) => {
          const value = await work(tx);
          if (first) {
            first = false;
            throw Error("Synthetic acquisition rollback");
          }
          return value;
        }, config),
    },
    c = controller(database);
  await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await expect(c.release()).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect((await rows()).state).toBe("idle");
  // RAM-only equivalent of destroying the uncertain dedicated backend; real runners MUST close the actual pool.
  await client.exec(`select pg_catalog.pg_advisory_unlock_all()`);
});
it("concurrent public operations are refused rather than interleaving transactions on a reserved session", async () => {
  const c = controller(),
    pending = c.begin(active());
  await expect(c.inspect(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect(await pending).not.toBeNull();
});

/** Deliberate driver-shape faults only; real engine/session/count semantics are covered separately. */
function changedDriver(
  transform: (
    kind: "select" | "update",
    fields: Record<string, unknown> | undefined,
    rows: Record<string, unknown>[],
  ) => Record<string, unknown>[],
): ResearchAdmissionDatabase {
  const mapQuery = (
    query: object,
    change: (rows: Record<string, unknown>[]) => Record<string, unknown>[],
  ): object =>
    new Proxy(query, {
      get(target, key) {
        if (key === "then")
          return (
            resolve: (value: unknown) => unknown,
            reject: (reason: unknown) => unknown,
          ) =>
            Promise.resolve(target)
              .then((rows) => change(rows as Record<string, unknown>[]))
              .then(resolve, reject);
        const value = Reflect.get(target, key, target);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const next = Reflect.apply(value, target, args);
          return next && typeof next === "object"
            ? mapQuery(next, change)
            : next;
        };
      },
    });
  return {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key, receiver) {
                if (key === "select")
                  return (fields?: Record<string, unknown>) =>
                    mapQuery(target.select(fields as never), (rows) =>
                      transform("select", fields, rows),
                    );
                if (key === "update")
                  return (table: never) =>
                    new Proxy(target.update(table), {
                      get(builder, method) {
                        if (method === "set")
                          return (values: Record<string, unknown>) =>
                            mapQuery(builder.set(values as never), (rows) =>
                              transform("update", values, rows),
                            );
                        const value = Reflect.get(builder, method, builder);
                        return typeof value === "function"
                          ? value.bind(builder)
                          : value;
                      },
                    });
                const value = Reflect.get(target, key, receiver);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          ),
        config,
      ),
  };
}
it.each([
  ["missing", () => undefined],
  ["nonfinite clock", (r: Record<string, unknown>) => ({ ...r, now: NaN })],
  ["negative clock", (r: Record<string, unknown>) => ({ ...r, now: -1 })],
  ["closed flag", (r: Record<string, unknown>) => ({ ...r, closed: "true" })],
  [
    "permit count",
    (r: Record<string, unknown>) => ({ ...r, expiredPermits: -1 }),
  ],
  [
    "packet count",
    (r: Record<string, unknown>) => ({ ...r, expiredPackets: NaN }),
  ],
  [
    "packet pair",
    (r: Record<string, unknown>) => ({
      ...r,
      expiredPermits: 1,
      expiredPackets: 3,
      all: 3,
      latest: Date.now(),
    }),
  ],
  ["total count", (r: Record<string, unknown>) => ({ ...r, all: NaN })],
  [
    "total below expired",
    (r: Record<string, unknown>) => ({
      ...r,
      expiredPermits: 1,
      expiredPackets: 1,
      all: 0,
    }),
  ],
  [
    "unexpected latest",
    (r: Record<string, unknown>) => ({ ...r, latest: Date.now() }),
  ],
  [
    "missing latest",
    (r: Record<string, unknown>) => ({ ...r, all: 1, latest: null }),
  ],
])(
  "rejects unsupported native observation %s without committing healthy",
  async (_name, change) => {
    const database = changedDriver((kind, fields, rows) => {
        if (kind !== "select" || !fields || !("expiredPermits" in fields))
          return rows;
        const value = change(rows[0]);
        return value ? [value] : [];
      }),
      c = controller(database),
      claim = await c.begin(active());
    await expect(
      c.finish(claim!, { permits: 0, packets: 0 }, active()),
    ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
    expect((await rows()).state).toBe("started");
  },
);
it.each(["missing", "revision", "run", "state"])(
  "rejects inconsistent final update %s data and rolls back the metadata transaction",
  async (field) => {
    const database = changedDriver((kind, fields, rows) => {
        if (kind !== "update" || fields?.state !== "healthy") return rows;
        if (field === "missing") return [];
        return rows.map((row) => ({
          ...row,
          ...(field === "revision"
            ? { revision: Number(row.revision) - 1 }
            : field === "run"
              ? { runId: createUuidV7() }
              : { state: "failed" }),
        }));
      }),
      c = controller(database),
      claim = await c.begin(active());
    await expect(
      c.finish(claim!, { permits: 0, packets: 0 }, active()),
    ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
    expect((await rows()).state).toBe("started");
  },
);
it("rejects inconsistent failure ACK rows rather than clearing unknown state", async () => {
  const database = changedDriver((kind, fields, rows) =>
      kind === "update" && fields?.state === "failed"
        ? rows.map((row) => ({ ...row, revision: Number(row.revision) - 1 }))
        : rows,
    ),
    c = controller(database),
    claim = await c.begin(active());
  await expect(c.fail(claim!, active())).rejects.toThrow(
    RESEARCH_MAINTENANCE_ERROR,
  );
  expect((await rows()).state).toBe("started");
});
it("rejects an out-of-range native advisory key before acquiring a session lock", async () => {
  const database = changedDriver((kind, fields, rows) =>
      kind === "select" && fields && "key" in fields
        ? rows.map((row) => ({ ...row, key: "9223372036854775808" }))
        : rows,
    ),
    c = controller(database);
  await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect((await rows()).state).toBe("idle");
  await c.release();
});
it("a changed physical backend between acquisition and start never publishes a run", async () => {
  let mode = 0;
  const database = changedDriver((kind, fields, rows) =>
      kind === "select" && fields && "isolation" in fields && ++mode === 2
        ? rows.map((row) => ({ ...row, pid: Number(row.pid) + 1 }))
        : rows,
    ),
    c = controller(database);
  await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect((await rows()).state).toBe("idle");
  await c.release();
});

it("teardown bounds an unacknowledged native transaction instead of claiming unlock or waiting forever", async () => {
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(0);
  const database: ResearchAdmissionDatabase = {
      transaction: vi.fn(() => new Promise<never>(() => {})),
    },
    c = controller(database),
    pending = c.begin(active()),
    refused = expect(pending).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await vi.advanceTimersByTimeAsync(0);
  expect(database.transaction).toHaveBeenCalledOnce();
  const closing = c.release(),
    unconfirmed = expect(closing).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  await vi.advanceTimersByTimeAsync(8000);
  await refused;
  await unconfirmed;
  expect(database.transaction).toHaveBeenCalledOnce();
});
it("inspection refuses an ignored READ ONLY mode rather than exposing apparent current operational health", async () => {
  const database: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(work, { ...config, accessMode: "read write" }),
  };
  await expect(controller(database).inspect(active())).rejects.toThrow(
    RESEARCH_MAINTENANCE_ERROR,
  );
});

it("a starved timer cannot start a second metadata SQL step after the absolute begin budget", async () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now),
    execute = vi.fn(async () => {
      now = 8001;
    }),
    select = vi.fn(),
    database: ResearchAdmissionDatabase = {
      transaction: async (work) => work({ execute, select } as never),
    },
    c = controller(database);
  try {
    await expect(c.begin(active())).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
    expect(execute).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
    await c.release();
  } finally {
    clock.mockRestore();
  }
});
it("an expired native lease observation cannot complete a still-started run", async () => {
  let expire = false;
  const database = changedDriver((kind, fields, rows) =>
      expire &&
      kind === "select" &&
      fields &&
      Object.keys(fields).join() === "now"
        ? rows.map((row) => ({ ...row, now: Date.now() + 60001 }))
        : rows,
    ),
    c = controller(database),
    claim = await c.begin(active());
  expire = true;
  await expect(
    c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).rejects.toThrow(RESEARCH_MAINTENANCE_ERROR);
  expect((await rows()).state).toBe("started");
});

it.each([NaN, Infinity, -Infinity, "bad"])(
  "refuses an invalid inherited work deadline %j before SQL",
  async (deadline) => {
    await fixture();
    const transaction = vi.fn();
    expect(() =>
      createSqlResearchMaintenance({ transaction }, input, deadline as number),
    ).toThrow(RESEARCH_MAINTENANCE_ERROR);
    expect(transaction).not.toHaveBeenCalled();
  },
);
it("an inherited deadline prevents any begin SQL and does not disable teardown", async () => {
  await fixture();
  const transaction = vi.fn(),
    c = createSqlResearchMaintenance(
      { transaction },
      input,
      performance.now() - 1,
    );
  controllers.push(c);
  await expect(c.begin(active())).rejects.toThrow();
  expect(transaction).not.toHaveBeenCalled();
  await c.release();
  expect(transaction).not.toHaveBeenCalled();
});
it("a shortened whole-run deadline fences later finish/inspection while releasing an already held session independently", async () => {
  await fixture();
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const c = createSqlResearchMaintenance(db, input, 1000);
  controllers.push(c);
  const claim = await c.begin(active());
  expect(claim).not.toBeNull();
  now = 1001;
  await expect(
    c.finish(claim!, { permits: 0, packets: 0 }, active()),
  ).rejects.toThrow();
  await expect(c.inspect(active())).rejects.toThrow();
  await c.release();
  const fresh = createSqlResearchMaintenance(db, input);
  controllers.push(fresh);
  expect(await fresh.begin(active())).not.toBeNull();
});

it("refuses an exhausted inherited failure deadline without consuming the active run", async () => {
  await fixture();
  const c = createSqlResearchMaintenance(db, input);
  controllers.push(c);
  const claim = await c.begin(active());
  expect(claim).not.toBeNull();
  await expect(
    c.fail(claim!, active(), performance.now() - 1),
  ).rejects.toThrow();
  expect((await c.inspect(active())).state).toBe("started");
  await c.fail(claim!, active(), performance.now() + 1000);
  expect((await c.inspect(active())).state).toBe("failed");
});
it("invalid teardown deadline cannot consume the only release attempt", async () => {
  await fixture();
  const c = createSqlResearchMaintenance(db, input);
  controllers.push(c);
  expect(await c.begin(active())).not.toBeNull();
  for (const bad of [NaN, Infinity, -Infinity, "bad"])
    await expect(c.release(bad as number)).rejects.toThrow();
  await c.release(performance.now() + 1000);
  const next = createSqlResearchMaintenance(db, input);
  controllers.push(next);
  expect(await next.begin(active())).not.toBeNull();
});
