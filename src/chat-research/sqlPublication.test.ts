/** Synthetic in-memory PostgreSQL controls; no real operator, corpus, provider or database connection. */
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { type SQL, sql } from "drizzle-orm";
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
import { chatResearchMaintenance as maintenance } from "../db/schema/chatResearchMaintenance";
import { chatResearchSourcePolicies as policies } from "../db/schema/chatResearchPolicy";
import { createUuidV7 } from "../lib/ids";
import {
  inspectResearchPublication,
  type PreparedResearchPublication,
  prepareResearchPublication,
  RESEARCH_PUBLICATION_ERROR,
} from "./publication";
import { publicationFixture } from "./publication.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchRetentionProfile } from "./retentionProfile";
import { prepareResearchSourcePolicy } from "./sourcePolicy";
import type {
  ResearchAdmissionDatabase,
  ResearchAdmissionTransaction,
} from "./sqlAdmission";
import { createSqlResearchMaintenance } from "./sqlMaintenance";
import {
  createSqlResearchPublisher,
  observeSqlResearchPublication,
} from "./sqlPublication";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
    schema: { windows, permits },
  }),
  active = () => new AbortController().signal;
beforeAll(async () => {
  for (const f of [
    "0022_massive_whiplash.sql",
    "0023_lethal_hydra.sql",
    "0024_chat_research_maintenance.sql",
  ])
    await client.exec(
      readFileSync(new URL(`../../drizzle/${f}`, import.meta.url), "utf8"),
    );
});
afterAll(() => client.close());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
let f: ReturnType<typeof publicationFixture>,
  prepared: PreparedResearchPublication;
function recompile() {
  const profile = prepareResearchRetentionProfile(f.retentionInput),
    read = prepareResearchReadEnvelope(f.readInput);
  prepared = prepareResearchPublication({
    ...f.input,
    retentionProfileJson: profile.document_json,
    retentionProfileSha256: profile.document_sha256,
    readEnvelopeJson: read.document_json,
    readEnvelopeSha256: read.document_sha256,
  });
}
beforeEach(async () => {
  await client.exec(
    "alter table public.chat_research_source_policies disable trigger chat_research_source_policy_truncate; alter table public.chat_research_artifacts disable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance disable trigger chat_research_maintenance_delete",
  );
  try {
    await client.exec(
      "truncate public.chat_research_source_policies,public.chat_research_maintenance,public.chat_research_artifacts,public.chat_research_permits,public.chat_research_windows",
    );
  } finally {
    await client.exec(
      "alter table public.chat_research_source_policies enable trigger chat_research_source_policy_truncate; alter table public.chat_research_artifacts enable trigger chat_research_artifact_delete; alter table public.chat_research_maintenance enable trigger chat_research_maintenance_delete",
    );
  }
  f = publicationFixture();
  const [{ oid }] = (
      await client.query<{ oid: number }>(
        "select 'public.chat_research_artifacts'::regclass::oid::bigint as oid",
      )
    ).rows,
    now = Date.now();
  Object.assign(f.scope, {
    windowId: createUuidV7(),
    beginsAtMs: now - 60000,
    expiresAtMs: now + 3600000,
  });
  Object.assign(f.sourceStorage, {
    schemaName: "public",
    authSchemaName: "public",
  });
  Object.assign(f.retentionInput, {
    storage: { schemaName: "public" },
    maintenance_schema: "public",
    artifact_table_oid: Number(oid),
  });
  Object.assign(f.readInput, {
    accounting_storage: { schemaName: "public" },
    read_until_ms: f.scope.beginsAtMs + 7 * 86400000,
  });
  recompile();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw Error("Unexpected provider call");
    }),
  );
});
const publisher = (database: ResearchAdmissionDatabase = db) =>
  createSqlResearchPublisher(database, prepared, prepared.sha256);
const publish = (database: ResearchAdmissionDatabase = db) =>
  publisher(database).publish(active());
const observe = (database: ResearchAdmissionDatabase = db) =>
  observeSqlResearchPublication(database, prepared, prepared.sha256, active());
const empty = async () => {
  expect(await db.select().from(windows)).toEqual([]);
  expect(await db.select().from(maintenance)).toEqual([]);
  expect(await db.select().from(policies)).toEqual([]);
};
async function existingPolicy(
  state: "published" | "revoked" | "draft" = "published",
  changed = false,
) {
  let p = f.source;
  if (changed) {
    const changed = structuredClone(f.policy);
    changed.sources[0].rights.processor_profiles!.push("other");
    p = prepareResearchSourcePolicy(changed);
  }
  await db.insert(policies).values({ ...p, state });
}
const dialect = new PgDialect();
function interceptExecute(
  before: (query: SQL, tx: ResearchAdmissionTransaction) => Promise<void>,
  after?: (query: SQL, result: unknown) => unknown,
): ResearchAdmissionDatabase {
  return {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key, receiver) {
                if (key === "execute")
                  return async (query: SQL) => {
                    await before(query, tx);
                    const r = await tx.execute(query);
                    return after ? after(query, r) : r;
                  };
                return Reflect.get(target, key, receiver);
              },
            }),
          ),
        config,
      ),
  };
}
const text = (q: SQL) => dialect.sqlToQuery(q).sql;
it("publishes the three exact records atomically and starts cleanup idle, without provider calls", async () => {
  expect(await observe()).toMatchObject({
    configuration: "absent",
    policy: "absent",
  });
  expect(await publish()).toEqual({
    kind: "private_research_publication_receipt",
    requested_manifest_sha256: prepared.sha256,
    outcome: "inserted",
  });
  expect(await observe()).toMatchObject({
    configuration: "matching",
    policy: "published",
  });
  expect(await db.select().from(windows)).toMatchObject([
    { id: f.scope.windowId, requestsUsed: 0, heldPico: 0, stopped: null },
  ]);
  expect(await db.select().from(maintenance)).toMatchObject([
    { state: "idle", revision: 1, controllerPid: null },
  ]);
  expect(await db.select().from(policies)).toMatchObject([
    { state: "published", revision: 1, policyJson: f.source.policyJson },
  ]);
  expect(fetch).not.toHaveBeenCalled();
});
it("reuses an exact shared published policy without updating its epoch", async () => {
  await existingPolicy();
  await publish();
  expect((await db.select().from(policies))[0].revision).toBe(1);
});
it.each(["revoked", "draft", "changed"] as const)(
  "refuses an existing %s policy and never repairs it",
  async (kind) => {
    await existingPolicy(
      kind === "changed" ? "published" : kind,
      kind === "changed",
    );
    const before = await db.select().from(policies);
    await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    expect(await db.select().from(policies)).toEqual(before);
    expect(await db.select().from(windows)).toEqual([]);
    expect(await db.select().from(maintenance)).toEqual([]);
  },
);
it("exact restart preserves spending, stop and the existing idle maintenance row", async () => {
  await publish();
  await db
    .update(windows)
    .set({ requestsUsed: 4, heldPico: 40, stopped: new Date() });
  // Native migration validates every state transition; use the real maintenance controller below in separate tests.
  const before = {
    w: await db.select().from(windows),
    m: await db.select().from(maintenance),
    p: await db.select().from(policies),
  };
  expect(await publish()).toMatchObject({ outcome: "already-matching" });
  expect({
    w: await db.select().from(windows),
    m: await db.select().from(maintenance),
    p: await db.select().from(policies),
  }).toEqual(before);
});
it.each(["beginsAtMs", "expiresAtMs"] as const)(
  "refuses initial publication with unusable native %s",
  async (key) => {
    if (key === "beginsAtMs")
      Object.assign(f.scope, {
        beginsAtMs: Date.now() + 60000,
        expiresAtMs: Date.now() + 120000,
      });
    else
      Object.assign(f.scope, {
        beginsAtMs: Date.now() - 120000,
        expiresAtMs: Date.now() - 60000,
      });
    Object.assign(f.readInput, {
      read_until_ms: f.scope.beginsAtMs + 7 * 86400000,
    });
    recompile();
    await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  },
);
it.each(["policy", "window", "maintenance"])(
  "rolls back every prior insert after an injected %s failure",
  async (name) => {
    const tableName =
      name === "policy"
        ? "chat_research_source_policies"
        : name === "window"
          ? "chat_research_windows"
          : "chat_research_maintenance";
    const database = interceptExecute(async (q) => {
      if (text(q).startsWith(`insert into "public"."${tableName}"`))
        throw Error("Injected statement failure");
    });
    await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  },
);
it("consumes one publisher attempt even after rollback and cannot automatically retry", async () => {
  const once = publisher(
    interceptExecute(async (q) => {
      if (text(q).startsWith("insert into")) throw Error("synthetic failure");
    }),
  );
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  await empty();
});
it("does not replay an unknown successful COMMIT; a fresh read observes configuration only", async () => {
  let callbacks = 0;
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      await db.transaction((tx) => {
        callbacks++;
        return work(tx);
      }, config);
      throw Error("lost commit ACK");
    },
  };
  const once = publisher(database);
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  expect(callbacks).toBe(1);
  expect(await observe()).toMatchObject({
    configuration: "matching",
    policy: "published",
  });
});
it("fresh reconciliation reports revocation without repairing or authorizing", async () => {
  await publish();
  await db.update(policies).set({ state: "revoked" });
  const before = await db.select().from(policies);
  expect(await observe()).toMatchObject({
    configuration: "matching",
    policy: "revoked",
  });
  await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  expect(await db.select().from(policies)).toEqual(before);
});
it("requires the independent exact manifest and original process-local handle before any SQL", () => {
  const database = { transaction: vi.fn() };
  for (const digest of ["f".repeat(64), "not-a-hash", prepared.sha256 + "\n"])
    expect(() =>
      createSqlResearchPublisher(database, prepared, digest),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
  expect(() =>
    createSqlResearchPublisher(database, { ...prepared }, prepared.sha256),
  ).toThrow();
  expect(database.transaction).not.toHaveBeenCalled();
});
it("refuses an outer transaction and a rollback-shaped adapter", async () => {
  await db.transaction(async (tx) => {
    expect(() =>
      createSqlResearchPublisher(tx as never, prepared, prepared.sha256),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
  });
  expect(() =>
    publisher({ transaction: db.transaction.bind(db), rollback: undefined }),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
});
it("refuses a callback-retrying root rather than silently rerunning the mutator", async () => {
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      await db.transaction(work, config);
      return db.transaction(work, config);
    },
  };
  await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  expect(await observe()).toMatchObject({ configuration: "matching" });
});
it("original deadline includes synchronous factory work and post-COMMIT acknowledgement", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const once = publisher();
  now = 8000;
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  await empty();
  now = 0;
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const r = await db.transaction(work, config);
      now = 8000;
      return r;
    },
  };
  await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  vi.restoreAllMocks();
  expect(await observe()).toMatchObject({ configuration: "matching" });
});
it("cancellation before SQL refuses without invoking the root", async () => {
  const database = { transaction: vi.fn() },
    signal = AbortSignal.abort();
  await expect(publisher(database).publish(signal)).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  expect(database.transaction).not.toHaveBeenCalled();
});
it("refuses an unexpected native isolation/access mode", async () => {
  const database: ResearchAdmissionDatabase = {
    transaction: (work) =>
      db.transaction(work, {
        isolationLevel: "serializable",
        accessMode: "read write",
      }),
  };
  await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  await empty();
});
it("requires the independently bound actual artifact OID", async () => {
  Object.assign(f.retentionInput, {
    artifact_table_oid: f.retentionInput.artifact_table_oid + 1,
  });
  recompile();
  await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  await empty();
});
it.each(["missing", "wrong-oid", "extra-row"])(
  "rolls back a %s mutation RETURNING result",
  async (kind) => {
    const database = interceptExecute(
      async () => {},
      (q, result) =>
        text(q).startsWith("insert into")
          ? kind === "missing"
            ? { rows: [] }
            : kind === "wrong-oid"
              ? { rows: [{ oid: 0 }] }
              : { rows: [{ oid: 1 }, { oid: 1 }] }
          : result,
    );
    await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  },
);

async function seedWindow(extra: Partial<typeof windows.$inferInsert> = {}) {
  const s = f.scope;
  await db.insert(windows).values({
    id: s.windowId,
    approvalSha256: s.approvalSha256,
    actorId: s.actorId,
    corpusVersion: s.corpusVersion,
    model: s.model,
    processorProfile: s.processorProfile,
    beginsAt: new Date(s.beginsAtMs),
    expiresAt: new Date(s.expiresAtMs),
    maxRequests: s.maxRequests,
    perRequestPico: s.perRequestPico,
    totalPico: s.totalPico,
    ...extra,
  });
}
async function seedMaintenance(
  extra: Partial<typeof maintenance.$inferInsert> = {},
) {
  const t = inspectResearchPublication(prepared).target;
  await db.insert(maintenance).values({
    profileSha256: t.profileSha256,
    targetSha256: t.targetSha256,
    artifactSchema: t.storage.schemaName,
    artifactTableOid: t.artifactTableOid,
    publicationCutoff: new Date(t.publicationCutoffMs),
    coverageThrough: new Date(t.coverageThroughMs),
    ...extra,
  });
}
it.each([
  "window-only",
  "profile-only",
  "both-without-policy",
  "other-window",
  "extra-window",
  "other-profile",
  "other-oid-same-namespace",
])("refuses partial or conflicting namespace contents: %s", async (kind) => {
  if (kind === "window-only" || kind === "both-without-policy")
    await seedWindow();
  if (kind === "profile-only" || kind === "both-without-policy")
    await seedMaintenance();
  if (kind === "other-window") await seedWindow({ id: createUuidV7() });
  if (kind === "extra-window") {
    await publish();
    await seedWindow({ id: createUuidV7(), approvalSha256: "b".repeat(64) });
  }
  if (kind === "other-profile")
    await seedMaintenance({ profileSha256: "b".repeat(64) });
  if (kind === "other-oid-same-namespace")
    await seedMaintenance({
      profileSha256: "b".repeat(64),
      artifactTableOid: f.retentionInput.artifact_table_oid + 1,
    });
  const before = {
    w: await db.select().from(windows),
    m: await db.select().from(maintenance),
    p: await db.select().from(policies),
  };
  await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  expect({
    w: await db.select().from(windows),
    m: await db.select().from(maintenance),
    p: await db.select().from(policies),
  }).toEqual(before);
  expect(await observe()).toMatchObject({
    configuration: kind === "both-without-policy" ? "matching" : "conflicting",
  });
});
it.each(["healthy", "closed"] as const)(
  "exact restart preserves real controller %s state and its revision",
  async (state) => {
    await publish();
    if (state === "closed")
      await db
        .update(windows)
        .set({ stopped: new Date(), requestsUsed: 2, heldPico: 20 });
    const t = inspectResearchPublication(prepared).target,
      c = createSqlResearchMaintenance(db, {
        scope: t.scope,
        storage: t.storage,
        maintenanceSchema: t.maintenanceSchema,
        profileSha256: t.profileSha256,
        artifactTableOid: t.artifactTableOid,
      });
    try {
      const run = await c.begin(active());
      expect(run).not.toBeNull();
      expect(
        await c.finish(run!, { permits: 0, packets: 0 }, active()),
      ).toMatchObject({ state, revision: 3 });
    } finally {
      await c.release();
    }
    const before = {
      w: await db.select().from(windows),
      m: await db.select().from(maintenance),
    };
    expect(await publish()).toMatchObject({ outcome: "already-matching" });
    expect({
      w: await db.select().from(windows),
      m: await db.select().from(maintenance),
    }).toEqual(before);
  },
);
it("recognizes exact expired configuration without renewing its dates, quota or policy", async () => {
  Object.assign(f.scope, {
    beginsAtMs: Date.now() - 120000,
    expiresAtMs: Date.now() - 60000,
  });
  Object.assign(f.readInput, {
    read_until_ms: f.scope.beginsAtMs + 7 * 86400000,
  });
  recompile();
  await existingPolicy();
  await seedWindow({ requestsUsed: 5, heldPico: 50, stopped: new Date() });
  await seedMaintenance();
  const before = await db.select().from(windows);
  expect(await publish()).toMatchObject({ outcome: "already-matching" });
  expect(await db.select().from(windows)).toEqual(before);
});
it.each(["draft", "changed"] as const)(
  "read-only reconciliation reports %s policy without changing any row",
  async (kind) => {
    await existingPolicy(
      kind === "draft" ? "draft" : "published",
      kind === "changed",
    );
    const before = await db.select().from(policies);
    expect(await observe()).toMatchObject({
      configuration: "absent",
      policy: kind,
    });
    expect(await db.select().from(policies)).toEqual(before);
  },
);
it("refuses an own preheld session lock instead of borrowing its reentrant ownership", async () => {
  const oid = f.retentionInput.artifact_table_oid;
  await client.query(
    "select pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('magickli-retention-controller-v1:'||$1::oid::text,0))",
    [oid],
  );
  try {
    await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  } finally {
    await client.query("select pg_catalog.pg_advisory_unlock_all()");
  }
});
it("missing durable artifact relation refuses before any publication write", async () => {
  await client.exec(
    "alter table public.chat_research_artifacts rename to synthetic_hidden_artifacts",
  );
  try {
    await expect(publish()).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  } finally {
    await client.exec(
      "alter table public.synthetic_hidden_artifacts rename to chat_research_artifacts",
    );
  }
});
it("an autocommit-shaped adapter cannot execute the publisher as independent statements", async () => {
  const database: ResearchAdmissionDatabase = {
    transaction: async (work) => work(db),
  };
  await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  await empty();
});
it("every write requires the original transaction-local nonce and rolls back on lost ownership", async () => {
  let invalidated = false;
  const database = interceptExecute(async (q, tx) => {
    if (!invalidated && text(q).startsWith("insert into")) {
      invalidated = true;
      await tx.execute(
        sql`select pg_catalog.set_config('magickli_publication.tx_nonce','',true)`,
      );
    }
  });
  await expect(publish(database)).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  expect(invalidated).toBe(true);
  await empty();
});
it("accepts the postgres-js array RETURNING representation as well as QueryResult.rows", async () => {
  const database = interceptExecute(
    async () => {},
    (q, result) =>
      text(q).startsWith("insert into")
        ? (result as { rows: unknown[] }).rows
        : result,
  );
  expect(await publish(database)).toMatchObject({ outcome: "inserted" });
});
it("a synchronous factory-tail timeout cannot create a fresh eight-second allowance", () => {
  let calls = 0;
  vi.spyOn(performance, "now").mockImplementation(() =>
    calls++ === 0 ? 0 : 8000,
  );
  expect(() => publisher()).toThrow(RESEARCH_PUBLICATION_ERROR);
});
it("matching SQL facts do not attest the original full read envelope or auth namespace", async () => {
  await publish();
  const old = prepared,
    read = prepareResearchReadEnvelope({
      ...f.readInput,
      source_storage: {
        ...f.sourceStorage,
        authSchemaName: "other_synthetic_auth",
      },
      read_until_ms: f.readInput.read_until_ms - 1,
    });
  prepared = prepareResearchPublication({
    ...f.input,
    retentionProfileJson:
      inspectResearchPublication(old).retention_profile_json,
    retentionProfileSha256:
      inspectResearchPublication(old).target.profileSha256,
    sourceStorage: {
      ...f.sourceStorage,
      authSchemaName: "other_synthetic_auth",
    },
    readEnvelopeJson: read.document_json,
    readEnvelopeSha256: read.document_sha256,
  });
  expect(prepared.sha256).not.toBe(old.sha256);
  expect(await publish()).toEqual({
    kind: "private_research_publication_receipt",
    requested_manifest_sha256: prepared.sha256,
    outcome: "already-matching",
  });
  expect(await observe()).toMatchObject({
    configuration: "matching",
    requested_manifest_sha256: prepared.sha256,
  });
});

/** RAM-only query bracket: changes the actual SQL namespace before a real SELECT and restores it before the later final guard. */
function bracketSelect(
  projection: string,
  before: (tx: ResearchAdmissionTransaction) => Promise<void>,
  after: (tx: ResearchAdmissionTransaction) => Promise<void>,
): ResearchAdmissionDatabase {
  let used = false;
  function wrap<T extends object>(
    builder: T,
    tx: ResearchAdmissionTransaction,
  ): T {
    return new Proxy(builder, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (
          ["from", "where", "for"].includes(String(key)) &&
          typeof value === "function"
        )
          return (...args: unknown[]) =>
            wrap(Reflect.apply(value, target, args), tx);
        if (key === "then")
          return (
            resolve: (r: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => {
            const pending = (async () => {
              await before(tx);
              try {
                return await target;
              } finally {
                await after(tx);
              }
            })();
            return pending.then(resolve, reject);
          };
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  }
  return {
    transaction: (work, config) =>
      db.transaction(
        (tx) =>
          work(
            new Proxy(tx, {
              get(target, key) {
                const value = Reflect.get(target, key, target);
                if (key === "select")
                  return (fields: Record<string, unknown>) => {
                    const builder = target.select(fields as never);
                    if (used || !(projection in fields)) return builder;
                    used = true;
                    return wrap(builder, tx);
                  };
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          ),
        config,
      ),
  };
}
it.each(["windows", "matches"] as const)(
  "rejects a restored-after-read copied namespace in the actual %s read",
  async (projection) => {
    await publish();
    const names = [
      "chat_research_source_policies",
      "chat_research_maintenance",
      "chat_research_windows",
      "chat_research_permits",
      "chat_research_artifacts",
    ];
    await client.exec("create schema synthetic_publication_copy");
    try {
      for (const name of names)
        await client.exec(
          `create table synthetic_publication_copy.${name} (like public.${name} including all); insert into synthetic_publication_copy.${name} select * from public.${name}`,
        );
      // RAM fixture only: leave the original exact artifact OID, but remove its window/profile so copied records would lie about a matching original setup.
      await client.exec(
        "alter table public.chat_research_maintenance disable trigger chat_research_maintenance_delete; delete from public.chat_research_maintenance; alter table public.chat_research_maintenance enable trigger chat_research_maintenance_delete; delete from public.chat_research_windows",
      );
      let swapped = false,
        restored = false;
      const database = bracketSelect(
        projection,
        async (tx) => {
          await tx.execute(
            sql`alter schema public rename to synthetic_publication_parking`,
          );
          await tx.execute(
            sql`alter schema synthetic_publication_copy rename to public`,
          );
          await tx.execute(
            sql`alter schema synthetic_publication_parking rename to synthetic_publication_copy`,
          );
          swapped = true;
        },
        async (tx) => {
          await tx.execute(
            sql`alter schema public rename to synthetic_publication_parking`,
          );
          await tx.execute(
            sql`alter schema synthetic_publication_copy rename to public`,
          );
          await tx.execute(
            sql`alter schema synthetic_publication_parking rename to synthetic_publication_copy`,
          );
          restored = true;
        },
      );
      await expect(publish(database)).rejects.toThrow(
        RESEARCH_PUBLICATION_ERROR,
      );
      expect({ swapped, restored }).toEqual({ swapped: true, restored: true });
      expect(await observe()).toMatchObject({
        configuration: "absent",
        policy: "published",
      });
    } finally {
      await client.exec(
        `drop table ${names.map((n) => `synthetic_publication_copy.${n}`).join(",")} restrict; drop schema synthetic_publication_copy restrict`,
      );
    }
  },
);
it.each([NaN, Infinity, -Infinity, "bad"])(
  "refuses invalid inherited monotonic deadline %s before SQL",
  (deadline) => {
    const database = { transaction: vi.fn() };
    expect(() =>
      createSqlResearchPublisher(
        database,
        prepared,
        prepared.sha256,
        deadline as number,
      ),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
    expect(database.transaction).not.toHaveBeenCalled();
  },
);
it("inherited deadline stops late SQL completion even before its timer can run", async () => {
  let now = 0,
    completedInsert = false;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const database = interceptExecute(
    async () => {},
    (q, result) => {
      if (text(q).startsWith("insert into")) {
        completedInsert = true;
        now = 1000;
      }
      return result;
    },
  );
  const once = createSqlResearchPublisher(
    database,
    prepared,
    prepared.sha256,
    1000,
  );
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  expect(completedInsert).toBe(true);
  vi.restoreAllMocks();
  await empty();
});
it("inherited post-COMMIT cutoff refuses the receipt and leaves only descriptive fresh reconciliation", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const r = await db.transaction(work, config);
      now = 1000;
      return r;
    },
  };
  await expect(
    createSqlResearchPublisher(
      database,
      prepared,
      prepared.sha256,
      1000,
    ).publish(active()),
  ).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  vi.restoreAllMocks();
  expect(await observe()).toMatchObject({ configuration: "matching" });
});
it("an inherited later deadline cannot extend the original eight-second factory bound", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const database = { transaction: vi.fn() };
  const once = createSqlResearchPublisher(
    database,
    prepared,
    prepared.sha256,
    9000,
  );
  now = 8000;
  await expect(once.publish(active())).rejects.toThrow(
    RESEARCH_PUBLICATION_ERROR,
  );
  expect(database.transaction).not.toHaveBeenCalled();
});
it("fresh read-only reconciliation also consumes its inherited monotonic deadline", async () => {
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const database: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const r = await db.transaction(work, config);
      now = 1000;
      return r;
    },
  };
  await expect(
    observeSqlResearchPublication(
      database,
      prepared,
      prepared.sha256,
      active(),
      1000,
    ),
  ).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
  vi.restoreAllMocks();
  await empty();
});

async function originalTableOids() {
  const result = await client.query<{
    policies: number;
    maintenance: number;
    windows: number;
    permits: number;
    artifacts: number;
  }>(
    "select 'public.chat_research_source_policies'::regclass::oid::bigint::double precision policies,'public.chat_research_maintenance'::regclass::oid::bigint::double precision maintenance,'public.chat_research_windows'::regclass::oid::bigint::double precision windows,'public.chat_research_permits'::regclass::oid::bigint::double precision permits,'public.chat_research_artifacts'::regclass::oid::bigint::double precision artifacts",
  );
  return result.rows[0];
}
it("publishes only into all five independently captured original relation identities", async () => {
  const pins = await originalTableOids(),
    owner = createSqlResearchPublisher(
      db,
      prepared,
      prepared.sha256,
      undefined,
      pins,
    );
  // Caller mutation cannot replace the identities owned at construction.
  pins.policies += 1000;
  expect((await owner.publish(active())).outcome).toBe("inserted");
  expect(await db.select().from(windows)).toHaveLength(1);
});
it.each([
  "policies",
  "maintenance",
  "windows",
  "permits",
  "artifacts",
] as const)(
  "refuses a changed original %s OID before any publication write",
  async (key) => {
    const pins = await originalTableOids();
    pins[key] += 1000;
    await expect(
      createSqlResearchPublisher(
        db,
        prepared,
        prepared.sha256,
        undefined,
        pins,
      ).publish(active()),
    ).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  },
);
it.each([0, NaN, 4294967296, undefined, "duplicate", null])(
  "refuses malformed trusted original relation pins (%s)",
  async (value) => {
    const pins = await originalTableOids();
    const input =
      value === null
        ? null
        : { ...pins, policies: value === "duplicate" ? pins.windows : value };
    expect(() =>
      createSqlResearchPublisher(
        db,
        prepared,
        prepared.sha256,
        undefined,
        input as never,
      ),
    ).toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
  },
);
it("refuses an actual same-name replacement of the original source-policy relation", async () => {
  const pins = await originalTableOids();
  await client.exec(
    "alter table public.chat_research_source_policies rename to held_original_source_policies;create table public.chat_research_source_policies(like public.held_original_source_policies including all)",
  );
  try {
    const current = await originalTableOids();
    expect(current.policies).not.toBe(pins.policies);
    await expect(
      createSqlResearchPublisher(
        db,
        prepared,
        prepared.sha256,
        undefined,
        pins,
      ).publish(active()),
    ).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
    await empty();
    expect(
      (await client.query("select * from public.held_original_source_policies"))
        .rows,
    ).toEqual([]);
  } finally {
    await client.exec(
      "drop table public.chat_research_source_policies;alter table public.held_original_source_policies rename to chat_research_source_policies",
    );
  }
});

it("retains exact original table pins during descriptive fresh-root observation", async () => {
  const pins = await originalTableOids();
  await createSqlResearchPublisher(
    db,
    prepared,
    prepared.sha256,
    undefined,
    pins,
  ).publish(active());
  expect(
    (
      await observeSqlResearchPublication(
        db,
        prepared,
        prepared.sha256,
        active(),
        undefined,
        pins,
      )
    ).configuration,
  ).toBe("matching");
  await expect(
    observeSqlResearchPublication(
      db,
      prepared,
      prepared.sha256,
      active(),
      undefined,
      { ...pins, policies: pins.policies + 1000 },
    ),
  ).rejects.toThrow(RESEARCH_PUBLICATION_ERROR);
});
it("refuses extra original-target fields rather than silently ignoring them", async () => {
  const pins = await originalTableOids();
  expect(() =>
    createSqlResearchPublisher(db, prepared, prepared.sha256, undefined, {
      ...pins,
      unrelated: pins.windows,
    } as never),
  ).toThrow(RESEARCH_PUBLICATION_ERROR);
});
