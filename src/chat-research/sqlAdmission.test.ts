import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { createUuidV7 } from "../lib/ids";
import {
  createSqlResearchAdmission,
  type ResearchAccountingScope,
  type ResearchAdmissionDatabase,
  type ResearchReservationRequest,
} from "./sqlAdmission";

vi.mock("server-only", () => ({}));
const h = await createMemoryPgliteHarness({ schema: { windows, permits } });
const db = h.db;
afterAll(() => h.client.close());
const active = () => new AbortController().signal;
const hash = (x: unknown) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
let scope: ResearchAccountingScope,
  sessionId: string,
  store: ReturnType<typeof createSqlResearchAdmission>;
function row(s: ResearchAccountingScope) {
  return {
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
  };
}
const request = (
  extra: Partial<ResearchReservationRequest> = {},
): ResearchReservationRequest => ({
  operationId: createUuidV7(),
  actorId: scope.actorId,
  sessionId,
  requestSha256: "a".repeat(64),
  sourceContextSha256: "b".repeat(64),
  upperPico: 10000000000,
  quoteExpiresAtMs: Date.now() + 50000,
  ...extra,
});
const completed = (reportedPico = 1000) => ({
  outcome: "completed",
  reportedPico,
  responseSha256: "c".repeat(64),
  answerSha256: "d".repeat(64),
});
async function saved() {
  return (
    await db.select().from(windows).where(eq(windows.id, scope.windowId))
  )[0];
}
async function dispatch(r = request()) {
  const receipt = await store.reserve(r, active());
  const claim = await store.beginDispatch(
    receipt.permitId,
    r.actorId,
    r.sessionId,
    active(),
  );
  if (!claim) throw Error("Synthetic missing claim");
  return { receipt, claim, request: r };
}
beforeEach(async () => {
  await db.delete(permits);
  await db.delete(windows);
  const now = Date.now();
  scope = {
    windowId: createUuidV7(),
    approvalSha256: "e".repeat(64),
    actorId: createUuidV7(),
    corpusVersion: "f".repeat(64),
    model: "openai/synthetic-answer",
    processorProfile: "synthetic_private_profile",
    beginsAtMs: now - 1000,
    expiresAtMs: now + 3599000,
    maxRequests: 3,
    perRequestPico: 20000000000,
    totalPico: 30000000000,
  };
  sessionId = createUuidV7();
  await db.insert(windows).values(row(scope));
  store = createSqlResearchAdmission(db, scope);
});

it("starts inert and never creates or renews an approval/window", async () => {
  await db.delete(windows);
  await expect(store.reserve(request(), active())).rejects.toThrow(
    "Private research admission unavailable",
  );
  expect(await db.select().from(windows)).toEqual([]);
  expect(await db.select().from(permits)).toEqual([]);
});
it("returns one exact idempotent reservation across repository instances and rejects changed bindings", async () => {
  const r = request(),
    other = createSqlResearchAdmission(db, { ...scope });
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      (i % 2 ? store : other).reserve({ ...r }, active()),
    ),
  );
  expect(new Set(results.map((r) => r.permitId)).size).toBe(1);
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: r.upperPico,
  });
  for (const delta of [
    { requestSha256: "c".repeat(64) },
    { sourceContextSha256: "c".repeat(64) },
    { upperPico: r.upperPico - 1 },
    { quoteExpiresAtMs: r.quoteExpiresAtMs - 1 },
    { sessionId: createUuidV7() },
    { actorId: createUuidV7() },
  ])
    await expect(other.reserve({ ...r, ...delta }, active())).rejects.toThrow();
  expect(await db.select().from(permits)).toHaveLength(1);
});
it("allows one open permit globally and exactly the frozen sequential request capacity", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => store.reserve(request(), active())),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: 10000000000,
  });
  const [first] = await db.select().from(permits);
  const claim = await store.beginDispatch(
    first.id,
    scope.actorId,
    sessionId,
    active(),
  );
  await store.finish(claim!, completed(), active());
  for (let i = 0; i < 2; i++) {
    const next = await dispatch();
    await store.finish(next.claim, completed(), active());
  }
  await expect(store.reserve(request(), active())).rejects.toThrow();
  expect(await saved()).toMatchObject({
    requestsUsed: 3,
    heldPico: 30000000000,
  });
});
it("enforces per-call and aggregate money limits without refunding successful requests", async () => {
  await expect(
    store.reserve(request({ upperPico: scope.perRequestPico + 1 }), active()),
  ).rejects.toThrow();
  const first = await dispatch(request({ upperPico: 20000000000 }));
  await store.finish(first.claim, completed(0), active());
  await expect(
    store.reserve(request({ upperPico: 10000000001 }), active()),
  ).rejects.toThrow();
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: 20000000000,
  });
});
it("publishes exactly one opaque dispatch claim across workers, never a JSON clone or second-instance capability", async () => {
  const r = request(),
    permit = await store.reserve(r, active()),
    other = createSqlResearchAdmission(db, scope);
  const claims = await Promise.all([
    store.beginDispatch(permit.permitId, r.actorId, r.sessionId, active()),
    other.beginDispatch(permit.permitId, r.actorId, r.sessionId, active()),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const winner = claims[0] ? store : other,
    loser = claims[0] ? other : store,
    claim = claims.find(Boolean)!;
  await expect(loser.finish(claim, completed(), active())).rejects.toThrow();
  await expect(
    winner.finish(JSON.parse(JSON.stringify(claim)), completed(), active()),
  ).rejects.toThrow();
  expect(await winner.finish(claim, completed(), active())).toMatchObject({
    state: "completed",
  });
});
it("does not return a claim on an ambiguous dispatch commit ACK and blocks crash/restart retry", async () => {
  const r = request(),
    permit = await store.reserve(r, active());
  const ambiguous: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      await db.transaction(work, config);
      throw Error("Synthetic lost commit ACK");
    },
  };
  const restarted = createSqlResearchAdmission(ambiguous, scope);
  await expect(
    restarted.beginDispatch(permit.permitId, r.actorId, r.sessionId, active()),
  ).rejects.toThrow();
  expect(
    await store.inspect(permit.permitId, r.actorId, r.sessionId, active()),
  ).toMatchObject({ state: "dispatching" });
  expect(
    await store.beginDispatch(
      permit.permitId,
      r.actorId,
      r.sessionId,
      active(),
    ),
  ).toBeNull();
  await expect(store.reserve(request(), active())).rejects.toThrow();
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: r.upperPico,
  });
});
it("recovers an ambiguous reservation ACK by exact identity without a second hold", async () => {
  const r = request();
  const ambiguous: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      await db.transaction(work, config);
      throw Error("Synthetic ACK lost");
    },
  };
  await expect(
    createSqlResearchAdmission(ambiguous, scope).reserve(r, active()),
  ).rejects.toThrow();
  const restored = await store.reserve(r, active());
  expect(restored.state).toBe("reserved");
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: r.upperPico,
  });
});
it.each([
  null,
  {},
  completed(-1),
  completed(NaN),
  { ...completed(), reportedPico: null },
  { ...completed(), extra: "Synthetic private detail" },
  completed(10000000001),
])(
  "commits indeterminate billing and stops admission for invalid result %j",
  async (result) => {
    const job = await dispatch();
    expect(await store.finish(job.claim, result, active())).toMatchObject({
      state: "indeterminate",
    });
    expect((await saved()).stopped).not.toBeNull();
    expect(await saved()).toMatchObject({
      requestsUsed: 1,
      heldPico: job.request.upperPico,
    });
    await expect(store.reserve(request(), active())).rejects.toThrow();
    expect(JSON.stringify(await db.select().from(permits))).not.toContain(
      "Synthetic private detail",
    );
  },
);
it.each(["failed", "indeterminate"] as const)(
  "retains full holds after explicit %s and makes only identical terminal settlement idempotent",
  async (outcome) => {
    const job = await dispatch(),
      result = { outcome, reportedPico: null, responseSha256: null };
    expect(await store.finish(job.claim, result, active())).toMatchObject({
      state: outcome,
    });
    expect(
      await store.finish(job.claim, { ...result }, active()),
    ).toMatchObject({ state: outcome });
    await expect(
      store.finish(job.claim, completed(), active()),
    ).rejects.toThrow();
    expect(await saved()).toMatchObject({
      requestsUsed: 1,
      heldPico: job.request.upperPico,
    });
  },
);
it("serializes simultaneous finalizers and never overwrites the first terminal result", async () => {
  const job = await dispatch();
  const results = await Promise.allSettled([
    store.finish(job.claim, completed(10), active()),
    store.finish(job.claim, completed(20), active()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const status = await store.inspect(
    job.receipt.permitId,
    scope.actorId,
    sessionId,
    active(),
  );
  expect([10, 20]).toContain(status.reportedPico);
  const identical = await Promise.all([
    store.finish(job.claim, completed(status.reportedPico!), active()),
    store.finish(job.claim, completed(status.reportedPico!), active()),
  ]);
  expect(identical).toHaveLength(2);
});
it("rolls back a failed settlement transaction, retains the open marker and can explicitly settle the same captured result", async () => {
  let failCommit = false;
  const broken: ResearchAdmissionDatabase = {
    transaction: (work, config) =>
      db.transaction(async (tx) => {
        const result = await work(tx);
        if (failCommit) throw Error("Synthetic rollback");
        return result;
      }, config),
  };
  store = createSqlResearchAdmission(broken, scope);
  const job = await dispatch();
  failCommit = true;
  await expect(store.finish(job.claim, {}, active())).rejects.toThrow();
  expect((await saved()).stopped).toBeNull();
  expect((await db.select().from(permits))[0].state).toBe("dispatching");
  failCommit = false;
  expect(await store.finish(job.claim, {}, active())).toMatchObject({
    state: "indeterminate",
  });
  expect((await saved()).stopped).not.toBeNull();
});
it("rejects foreign status/dispatch access, malformed requests, pre-abort and immutable window drift", async () => {
  for (const invalid of [
    { ...request(), extra: "Synthetic private question" },
    request({ operationId: "bad" }),
  ])
    await expect(store.reserve(invalid, active())).rejects.toThrow();
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(store.reserve(request(), cancelled.signal)).rejects.toThrow();
  const job = await store.reserve(request(), active());
  for (const identity of [
    [createUuidV7(), sessionId],
    [scope.actorId, createUuidV7()],
  ]) {
    await expect(
      store.inspect(job.permitId, ...(identity as [string, string]), active()),
    ).rejects.toThrow();
    await expect(
      store.beginDispatch(
        job.permitId,
        ...(identity as [string, string]),
        active(),
      ),
    ).rejects.toThrow();
  }
  await db
    .update(windows)
    .set({ model: "other/synthetic" })
    .where(eq(windows.id, scope.windowId));
  await expect(
    store.inspect(job.permitId, scope.actorId, sessionId, active()),
  ).rejects.toThrow();
});
it("checks fresh database time for window and quote bounds without reserving", async () => {
  for (const expires of [Date.now() - 1, Date.now() + 61000])
    await expect(
      store.reserve(request({ quoteExpiresAtMs: expires }), active()),
    ).rejects.toThrow();
  expect(await saved()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
  const past = {
    ...scope,
    beginsAtMs: Date.now() - 3600000,
    expiresAtMs: Date.now() - 1000,
  };
  await db.update(windows).set(row(past));
  await expect(
    createSqlResearchAdmission(db, past).reserve(request(), active()),
  ).rejects.toThrow();
});
it("refuses a dispatch after the original quote expires on the actual database clock", async () => {
  const r = request({ quoteExpiresAtMs: Date.now() + 1500 });
  const receipt = await store.reserve(r, active());
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(1, r.quoteExpiresAtMs - Date.now() + 20)),
  );
  await expect(
    store.beginDispatch(receipt.permitId, r.actorId, r.sessionId, active()),
  ).rejects.toThrow();
  expect((await db.select().from(permits))[0].state).toBe("reserved");
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: r.upperPico,
  });
}, 10000);
it("detects aggregate accounting drift instead of trusting a permitted counter range", async () => {
  await store.reserve(request(), active());
  await db
    .update(windows)
    .set({ heldPico: 0 })
    .where(eq(windows.id, scope.windowId));
  await expect(store.reserve(request(), active())).rejects.toThrow();
});
it("keeps database constraints distinct from aggregate repository checks", async () => {
  for (const delta of [
    { maxRequests: 11 },
    { requestsUsed: -1 },
    { perRequestPico: 350000000001 },
    { heldPico: scope.totalPico + 1 },
    { expiresAt: new Date(scope.beginsAtMs + 86400001) },
    { approvalSha256: "bad" },
  ])
    await expect(
      db.update(windows).set(delta).where(eq(windows.id, scope.windowId)),
    ).rejects.toThrow();
  const job = await dispatch();
  await expect(
    db
      .update(permits)
      .set({
        state: "completed",
        reportedPico: 1,
        responseSha256: "a".repeat(64),
        answerSha256: "b".repeat(64),
        resultSha256: hash(completed()),
        finishedAt: null,
      })
      .where(eq(permits.id, job.receipt.permitId)),
  ).rejects.toThrow();
  await expect(
    db
      .update(permits)
      .set({ state: "unexpected" as "reserved" })
      .where(eq(permits.id, job.receipt.permitId)),
  ).rejects.toThrow();
  await expect(
    db.insert(windows).values({ ...row(scope), id: createUuidV7() }),
  ).rejects.toThrow();
  await expect(db.delete(windows)).rejects.toThrow();
});
it("bounds scope configuration before touching a database", () => {
  for (const delta of [
    { maxRequests: 11 },
    { totalPico: 3500000000001 },
    { expiresAtMs: scope.beginsAtMs },
    { expiresAtMs: scope.beginsAtMs + 86400001 },
    { actorId: "email@example.invalid" },
  ])
    expect(() =>
      createSqlResearchAdmission(db, { ...scope, ...delta }),
    ).toThrow("Private research admission unavailable");
});

it("rejects a nested transaction/savepoint handle before any claim can escape outer rollback", async () => {
  await expect(
    db.transaction(async (tx) => {
      expect(() =>
        // @ts-expect-error a savepoint runner cannot confirm a durable top-level commit
        createSqlResearchAdmission(tx, scope),
      ).toThrow("Private research admission unavailable");
      throw Error("Synthetic outer rollback");
    }),
  ).rejects.toThrow("Synthetic outer rollback");
  expect(await db.select().from(permits)).toEqual([]);
  expect(await saved()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
});
it("rejects constraint-valid terminal corruption on replay, inspection and subsequent admission", async () => {
  const job = await dispatch();
  await store.finish(job.claim, completed(1000), active());
  await db
    .update(permits)
    .set({ reportedPico: 999 })
    .where(eq(permits.id, job.receipt.permitId));
  await expect(
    store.finish(job.claim, completed(1000), active()),
  ).rejects.toThrow();
  await expect(
    store.inspect(job.receipt.permitId, scope.actorId, sessionId, active()),
  ).rejects.toThrow();
  await expect(store.reserve(request(), active())).rejects.toThrow();
});
it("rejects a reopened failed/indeterminate window instead of silently admitting a new job", async () => {
  const job = await dispatch();
  await store.finish(job.claim, {}, active());
  await db
    .update(windows)
    .set({ stopped: null })
    .where(eq(windows.id, scope.windowId));
  await expect(store.reserve(request(), active())).rejects.toThrow();
  await expect(
    store.inspect(job.receipt.permitId, scope.actorId, sessionId, active()),
  ).rejects.toThrow();
});

it("rejects a constraint-valid request/context fingerprint change instead of dispatching substituted work", async () => {
  const job = await store.reserve(request(), active());
  await db
    .update(permits)
    .set({ requestSha256: "c".repeat(64) })
    .where(eq(permits.id, job.permitId));
  await expect(
    store.beginDispatch(job.permitId, scope.actorId, sessionId, active()),
  ).rejects.toThrow();
  await expect(
    store.inspect(job.permitId, scope.actorId, sessionId, active()),
  ).rejects.toThrow();
  expect(await saved()).toMatchObject({
    requestsUsed: 1,
    heldPico: 10000000000,
  });
});
it("rejects malformed and unknown permit handles without changing accounting", async () => {
  await expect(
    store.beginDispatch("bad", scope.actorId, sessionId, active()),
  ).rejects.toThrow();
  await expect(
    store.beginDispatch(createUuidV7(), scope.actorId, sessionId, active()),
  ).rejects.toThrow();
  await expect(
    store.inspect(createUuidV7(), scope.actorId, sessionId, active()),
  ).rejects.toThrow();
  expect(await saved()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
});
it("publishes no claim when cancellation arrives after a successful marker commit", async () => {
  const job = await store.reserve(request(), active()),
    controller = new AbortController();
  const cancelled: ResearchAdmissionDatabase = {
    transaction: async (work, config) => {
      const result = await db.transaction(work, config);
      controller.abort();
      return result;
    },
  };
  await expect(
    createSqlResearchAdmission(cancelled, scope).beginDispatch(
      job.permitId,
      scope.actorId,
      sessionId,
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(
    await store.inspect(job.permitId, scope.actorId, sessionId, active()),
  ).toMatchObject({ state: "dispatching" });
  expect(
    await store.beginDispatch(job.permitId, scope.actorId, sessionId, active()),
  ).toBeNull();
});

it("binds terminal fingerprints to their own permit/request/dispatch, even for identical outcome values", async () => {
  const first = await dispatch();
  await store.finish(first.claim, completed(), active());
  const second = await dispatch();
  await store.finish(second.claim, completed(), active());
  const rows = await db.select().from(permits);
  const a = rows.find((r) => r.id === first.receipt.permitId)!;
  const b = rows.find((r) => r.id === second.receipt.permitId)!;
  expect(a.resultSha256).not.toBe(b.resultSha256);
  await db
    .update(permits)
    .set({ resultSha256: a.resultSha256 })
    .where(eq(permits.id, b.id));
  await expect(
    store.inspect(b.id, scope.actorId, sessionId, active()),
  ).rejects.toThrow();
});

it("uses durable public accounting when pooled temporary tables try to shadow the same names", async () => {
  await db
    .update(windows)
    .set({ stopped: new Date() })
    .where(eq(windows.id, scope.windowId));
  await h.client.exec(`
    create temp table chat_research_windows (like public.chat_research_windows including all);
    create temp table chat_research_permits (like public.chat_research_permits including all);
    insert into pg_temp.chat_research_windows select * from public.chat_research_windows;
    update pg_temp.chat_research_windows set stopped_at=null;
  `);
  try {
    await expect(store.reserve(request(), active())).rejects.toThrow();
    const real = await h.client.query<{ count: number }>(
      "select count(*)::int as count from public.chat_research_permits",
    );
    const fake = await h.client.query<{ count: number }>(
      "select count(*)::int as count from pg_temp.chat_research_permits",
    );
    expect(real.rows[0].count).toBe(0);
    expect(fake.rows[0].count).toBe(0);
  } finally {
    await h.client.exec(
      "drop table pg_temp.chat_research_permits,pg_temp.chat_research_windows",
    );
  }
});

it("fails closed on an unmigrated public target even when active same-named temp ledgers exist", async () => {
  await h.client.exec(`
    alter table public.chat_research_permits rename to absent_permits;
    alter table public.chat_research_windows rename to absent_windows;
    create temp table chat_research_windows (like public.absent_windows including all);
    create temp table chat_research_permits (like public.absent_permits including all);
    insert into pg_temp.chat_research_windows select * from public.absent_windows;
  `);
  try {
    await expect(store.reserve(request(), active())).rejects.toThrow();
    const fake = await h.client.query<{ count: number }>(
      "select count(*)::int as count from pg_temp.chat_research_permits",
    );
    const real = await h.client.query<{ count: number }>(
      "select requests_used::int as count from public.absent_windows",
    );
    expect(fake.rows[0].count).toBe(0);
    expect(real.rows[0].count).toBe(0);
  } finally {
    await h.client.exec(`
      drop table pg_temp.chat_research_permits,pg_temp.chat_research_windows;
      alter table public.absent_windows rename to chat_research_windows;
      alter table public.absent_permits rename to chat_research_permits;
    `);
  }
});
it("rejects a public view substituted for an ordinary durable accounting table", async () => {
  await h.client.exec(`
    alter table public.chat_research_windows rename to ordinary_windows;
    create view public.chat_research_windows as select * from public.ordinary_windows;
  `);
  try {
    await expect(store.reserve(request(), active())).rejects.toThrow();
    const real = await h.client.query<{ count: number }>(
      "select requests_used::int as count from public.ordinary_windows",
    );
    expect(real.rows[0].count).toBe(0);
  } finally {
    await h.client.exec(`
      drop view public.chat_research_windows;
      alter table public.ordinary_windows rename to chat_research_windows;
    `);
  }
});

async function isolatedNamespace() {
  const name = `corpus_admission_${randomBytes(12).toString("hex")}`;
  const ddl = readFileSync(
    new URL("../../drizzle/0021_wooden_rocket_raccoon.sql", import.meta.url),
    "utf8",
  );
  const expected = 'REFERENCES "public"."chat_research_windows"';
  if (ddl.split(expected).length !== 2)
    throw Error("Synthetic migration shape drift");
  try {
    await h.client.exec(`begin; create schema "${name}"; set local search_path="${name}",public;
      ${ddl.replace(expected, `REFERENCES "${name}"."chat_research_windows"`)} commit;`);
  } catch (error) {
    await h.client.exec("rollback");
    throw error;
  }
  return {
    name,
    async copyWindow() {
      await h.client.exec(
        `insert into "${name}".chat_research_windows select * from public.chat_research_windows`,
      );
    },
    async close() {
      await h.client.exec(
        `drop table "${name}".chat_research_permits,"${name}".chat_research_windows restrict; drop schema "${name}" restrict`,
      );
    },
  };
}
it("isolates the exact repository in a trusted durable namespace without touching public accounting", async () => {
  const ns = await isolatedNamespace();
  try {
    await ns.copyWindow();
    const config = { schemaName: ns.name },
      local = createSqlResearchAdmission(db, scope, config);
    config.schemaName = "public";
    const r = request(),
      receipt = await local.reserve(r, active());
    const claim = await local.beginDispatch(
      receipt.permitId,
      r.actorId,
      r.sessionId,
      active(),
    );
    expect(await local.finish(claim!, completed(), active())).toMatchObject({
      state: "completed",
    });
    expect(await saved()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
    expect(await db.select().from(permits)).toEqual([]);
    await expect(
      store.inspect(receipt.permitId, r.actorId, r.sessionId, active()),
    ).rejects.toThrow();
  } finally {
    await ns.close();
  }
});
it("rejects copied nonempty permit identity across accounting namespaces", async () => {
  const a = await isolatedNamespace(),
    b = await isolatedNamespace();
  try {
    await a.copyWindow();
    await b.copyWindow();
    const first = createSqlResearchAdmission(db, scope, { schemaName: a.name });
    const second = createSqlResearchAdmission(db, scope, {
      schemaName: b.name,
    });
    const receipt = await first.reserve(request(), active());
    await h.client.exec(`insert into "${b.name}".chat_research_permits select * from "${a.name}".chat_research_permits;
      update "${b.name}".chat_research_windows set requests_used=1,held_pico=10000000000;`);
    await expect(
      second.inspect(receipt.permitId, scope.actorId, sessionId, active()),
    ).rejects.toThrow();
    await expect(
      second.beginDispatch(
        receipt.permitId,
        scope.actorId,
        sessionId,
        active(),
      ),
    ).rejects.toThrow();
    expect(await saved()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
  } finally {
    await a.close();
    await b.close();
  }
});
it("refuses invalid or missing namespaces and never takes namespace configuration from a request", async () => {
  for (const config of [
    { schemaName: "pg_temp" },
    { schemaName: "information_schema" },
    { schemaName: "public;drop table" },
    { schemaName: "a.b" },
    { schemaName: "UPPERCASE" },
    { schemaName: "public\n" },
    { schemaName: "x".repeat(64) },
    { schemaName: "public", extra: true },
  ])
    expect(() => createSqlResearchAdmission(db, scope, config)).toThrow();
  await expect(
    createSqlResearchAdmission(db, scope, {
      schemaName: "missing_namespace",
    }).reserve(request(), active()),
  ).rejects.toThrow();
  await expect(
    store.reserve(
      { ...request(), schemaName: "public" } as ResearchReservationRequest,
      active(),
    ),
  ).rejects.toThrow();
  expect(await saved()).toMatchObject({ requestsUsed: 0, heldPico: 0 });
});
