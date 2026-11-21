/** Synthetic expired packet fixtures; these are not valid stored answers or real source material. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createMemoryPgliteHarness } from "@gadicc/loom/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { shortResearchArtifactsDdl } from "../../tests/chat-research/shortRetentionDdl";
import {
  chatResearchPermits as permits,
  chatResearchWindows as windows,
} from "../db/schema/chatResearch";
import { chatResearchArtifacts as artifacts } from "../db/schema/chatResearchArtifacts";
import { createUuidV7 } from "../lib/ids";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";
import {
  createSqlResearchRetentionTick,
  RESEARCH_RETENTION_ERROR,
} from "./retentionWorker";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";
import * as artifactModule from "./sqlArtifacts";
import { createSqlResearchArtifactPurger } from "./sqlArtifacts";

vi.mock("server-only", () => ({}));
const { db, client } = await createMemoryPgliteHarness({
  schema: { windows, permits },
});
const active = () => new AbortController().signal;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
beforeAll(async () => {
  await client.exec(
    readFileSync(
      new URL("../../drizzle/0023_lethal_hydra.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.exec(shortResearchArtifactsDdl);
});
afterAll(() => client.close());
beforeEach(async () => {
  await createSqlResearchArtifactPurger(db)(100, active());
});
async function pair(expired = true) {
  const now = Date.now(),
    at = now - 10000 - (expired ? RESEARCH_ARTIFACT_RETENTION_MS : 0),
    windowId = createUuidV7(),
    permitId = createUuidV7(),
    actor = createUuidV7();
  await db.insert(windows).values({
    id: windowId,
    approvalSha256: sha(windowId),
    actorId: actor,
    corpusVersion: "a".repeat(64),
    model: "synthetic-model",
    processorProfile: "synthetic",
    beginsAt: new Date(at - 1000),
    expiresAt: new Date(at + 3600000),
    maxRequests: 10,
    perRequestPico: 100,
    totalPico: 1000,
  });
  // Counters/descriptor deliberately do not match; expiry must not need valid accounting or a session/policy.
  await db.insert(permits).values({
    id: permitId,
    windowId,
    operationId: createUuidV7(),
    actorId: actor,
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
  return {
    windowId,
    permitId,
    retainUntil: at + RESEARCH_ARTIFACT_RETENTION_MS,
  };
}
async function packetRows(id: string) {
  return db.select().from(artifacts).where(eq(artifacts.permitId, id));
}
it("logically purges expired request/result pairs despite corrupt counters and observes fresh native zero backlog", async () => {
  const old = await pair(),
    live = await pair(false),
    beforeLive = await packetRows(live.permitId),
    beforeWindow = await db
      .select()
      .from(windows)
      .where(eq(windows.id, old.windowId)),
    beforePermit = await db
      .select()
      .from(permits)
      .where(eq(permits.id, old.permitId)),
    tick = createSqlResearchRetentionTick(db, {}, 1),
    result = await tick.run(active());
  expect(result).toMatchObject({
    status: "no-expired-packets-observed",
    purged_permits: 1,
    purged_packets: 2,
    expired_permits: 0,
    expired_packets: 0,
    oldest_expired_at_ms: null,
  });
  expect(result.observed_at_ms).toBeGreaterThanOrEqual(old.retainUntil);
  expect(
    (await packetRows(old.permitId)).every(
      (row) =>
        row.packetJson === null &&
        row.purgedAt !== null &&
        row.packetSha256 === sha("{}"),
    ),
  ).toBe(true);
  expect(await packetRows(live.permitId)).toEqual(beforeLive);
  expect(
    await db.select().from(windows).where(eq(windows.id, old.windowId)),
  ).toEqual(beforeWindow);
  expect(
    await db.select().from(permits).where(eq(permits.id, old.permitId)),
  ).toEqual(beforePermit);
  await expect(tick.run(active())).rejects.toThrow(RESEARCH_RETENTION_ERROR);
  expect(await createSqlResearchRetentionTick(db).run(active())).toMatchObject({
    purged_permits: 0,
    purged_packets: 0,
    expired_packets: 0,
  });
});
it("reports remaining expired payloads honestly when one bounded batch cannot finish them", async () => {
  const fixtures = await Promise.all([pair(), pair(), pair()]),
    before = Date.now(),
    result = await createSqlResearchRetentionTick(db, {}, 1).run(active());
  expect(result).toMatchObject({
    status: "expired-packets-pending",
    purged_permits: 1,
    purged_packets: 2,
    expired_permits: 2,
    expired_packets: 4,
  });
  expect(result.oldest_expired_at_ms).toBeLessThan(before);
  expect(
    fixtures.some((x) => x.retainUntil === result.oldest_expired_at_ms),
  ).toBe(true);
  const second = await createSqlResearchRetentionTick(db, {}, 2).run(active());
  expect(second).toMatchObject({
    status: "no-expired-packets-observed",
    purged_permits: 2,
    purged_packets: 4,
    expired_packets: 0,
  });
});
it("owns its startup namespace/limit and never consults another namespace through fallback", async () => {
  const old = await pair(),
    storage = { schemaName: "public" },
    tick = createSqlResearchRetentionTick(db, storage, 1);
  storage.schemaName = "missing";
  expect(await tick.run(active())).toMatchObject({ purged_packets: 2 });
  expect((await packetRows(old.permitId))[0].packetJson).toBeNull();
  await expect(
    createSqlResearchRetentionTick(db, { schemaName: "missing" }).run(active()),
  ).rejects.toThrow(RESEARCH_RETENTION_ERROR);
});
it("refuses bad limits/namespaces and transaction/savepoint handles before I/O", async () => {
  for (const n of [0, 101, 1.5, NaN, Infinity])
    expect(() => createSqlResearchRetentionTick(db, {}, n)).toThrow(
      RESEARCH_RETENTION_ERROR,
    );
  for (const schemaName of [
    "bad-name",
    "public\n",
    "pg_temp",
    "information_schema",
    "x".repeat(64),
  ])
    expect(() => createSqlResearchRetentionTick(db, { schemaName })).toThrow(
      RESEARCH_RETENTION_ERROR,
    );
  await db.transaction(async (tx) => {
    expect(() =>
      createSqlResearchRetentionTick(
        tx as unknown as ResearchAdmissionDatabase,
      ),
    ).toThrow(RESEARCH_RETENTION_ERROR);
  });
});
it("refuses ignored READ ONLY mode and reports failure rather than claiming the preceding purge rolled back", async () => {
  const old = await pair(),
    database: ResearchAdmissionDatabase = {
      transaction: (work, config) =>
        db.transaction(
          work,
          config ? { ...config, accessMode: "read write" } : undefined,
        ),
    };
  await expect(
    createSqlResearchRetentionTick(database).run(active()),
  ).rejects.toThrow(RESEARCH_RETENTION_ERROR);
  expect((await packetRows(old.permitId))[0].packetJson).toBeNull();
});
it("an already cancelled tick is consumed and never mutates an expired packet", async () => {
  const old = await pair(),
    before = await packetRows(old.permitId),
    tick = createSqlResearchRetentionTick(db);
  await expect(tick.run(AbortSignal.abort())).rejects.toThrow(
    RESEARCH_RETENTION_ERROR,
  );
  expect(await packetRows(old.permitId)).toEqual(before);
  await expect(tick.run(active())).rejects.toThrow(RESEARCH_RETENTION_ERROR);
});
it("bounds a non-cooperative database without automatic retries or leaking driver errors", async () => {
  vi.useFakeTimers();
  try {
    const database: ResearchAdmissionDatabase = {
        transaction: vi.fn(() => new Promise<never>(() => {})),
      },
      tick = createSqlResearchRetentionTick(database),
      pending = tick.run(active());
    const assertion = expect(pending).rejects.toThrow(RESEARCH_RETENTION_ERROR);
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;
    await expect(tick.run(active())).rejects.toThrow(RESEARCH_RETENTION_ERROR);
    expect(database.transaction).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
it.each([
  ["missing", () => undefined],
  ["time", (r: Record<string, unknown>) => ({ ...r, now: NaN })],
  ["permit count", (r: Record<string, unknown>) => ({ ...r, permits: -1 })],
  ["packet count", (r: Record<string, unknown>) => ({ ...r, packets: NaN })],
  [
    "packet pair",
    (r: Record<string, unknown>) => ({
      ...r,
      permits: 1,
      packets: 3,
      oldest: 1,
    }),
  ],
  ["oldest when empty", (r: Record<string, unknown>) => ({ ...r, oldest: 1 })],
  [
    "missing oldest",
    (r: Record<string, unknown>) => ({
      ...r,
      permits: 1,
      packets: 1,
      oldest: null,
    }),
  ],
  [
    "future oldest",
    (r: Record<string, unknown>) => ({
      ...r,
      permits: 1,
      packets: 1,
      oldest: (r.now as number) + 1,
    }),
  ],
  [
    "fractional oldest",
    (r: Record<string, unknown>) => ({
      ...r,
      permits: 1,
      packets: 1,
      oldest: 0.5,
    }),
  ],
  [
    "isolation",
    (r: Record<string, unknown>) => ({ ...r, isolation: "repeatable read" }),
  ],
])(
  "rejects malformed native-driver %s data and emits no successful tick",
  async (_name, change) => {
    // Driver-shape refusal only; actual SQL backlog semantics are exercised above and natively.
    const database: ResearchAdmissionDatabase = {
      transaction: (work, config) =>
        db.transaction((tx) => {
          const proxy = new Proxy(tx, {
            get(target, key, receiver) {
              if (key !== "select") return Reflect.get(target, key, receiver);
              return (fields: Record<string, unknown>) => {
                if (!("packets" in fields))
                  return target.select(fields as never);
                return {
                  from: async () => {
                    const row = {
                      now: Date.now(),
                      permits: 0,
                      packets: 0,
                      oldest: null,
                      readOnly: "on",
                      isolation: "read committed",
                    };
                    const changed = change(row);
                    return changed ? [changed] : [];
                  },
                };
              };
            },
          });
          return work(proxy);
        }, config),
    };
    await expect(
      createSqlResearchRetentionTick(database).run(active()),
    ).rejects.toThrow(RESEARCH_RETENTION_ERROR);
  },
);

it("a delayed timer cannot start backlog SQL after purge consumed the entire tick deadline", async () => {
  let now = 0;
  const timer = vi.spyOn(performance, "now").mockImplementation(() => now),
    purge = vi.fn(async () => {
      now = 8001;
      return { permits: 0, packets: 0 };
    }),
    replacement = vi
      .spyOn(artifactModule, "createSqlResearchArtifactPurger")
      .mockReturnValueOnce(purge),
    database: ResearchAdmissionDatabase = { transaction: vi.fn() };
  try {
    await expect(
      createSqlResearchRetentionTick(database).run(active()),
    ).rejects.toThrow(RESEARCH_RETENTION_ERROR);
    expect(purge).toHaveBeenCalledOnce();
    expect(database.transaction).not.toHaveBeenCalled();
  } finally {
    replacement.mockRestore();
    timer.mockRestore();
  }
});
it("the purger stops before another SQL step when elapsed time expires without a timeout callback", async () => {
  let now = 0;
  const timer = vi.spyOn(performance, "now").mockImplementation(() => now),
    execute = vi.fn(async () => {
      now = 8001;
    }),
    select = vi.fn(),
    database: ResearchAdmissionDatabase = {
      transaction: async (work) => work({ execute, select } as never),
    };
  try {
    await expect(
      createSqlResearchArtifactPurger(database)(1, active()),
    ).rejects.toThrow("Private research artifact storage unavailable");
    expect(execute).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
  } finally {
    timer.mockRestore();
  }
});

it("pins the fresh observation path against hostile same-signature count/min aggregates", async () => {
  await client.exec(`create schema synthetic_retention_shadow;
    create function synthetic_retention_shadow.zero(bigint) returns bigint language sql immutable as 'select 0::bigint';
    create aggregate synthetic_retention_shadow.count(*) (sfunc=synthetic_retention_shadow.zero,stype=bigint,initcond='0');
    create function synthetic_retention_shadow.zerouuid(bigint,uuid) returns bigint language sql immutable as 'select 0::bigint';
    create aggregate synthetic_retention_shadow.count(uuid) (sfunc=synthetic_retention_shadow.zerouuid,stype=bigint,initcond='0');
    create function synthetic_retention_shadow.nulltime(timestamptz,timestamptz) returns timestamptz language sql immutable as 'select null::timestamptz';
    create aggregate synthetic_retention_shadow.min(timestamptz) (sfunc=synthetic_retention_shadow.nulltime,stype=timestamptz);`);
  await pair();
  await pair();
  try {
    await client.exec(`set search_path=synthetic_retention_shadow,pg_catalog`);
    // Demonstrate the attack surface on this actual in-memory engine.
    const [shadow] = (
      await client.query<{ packets: number }>(
        `select count(*)::integer packets from public.chat_research_artifacts where purged_at is null and retain_until<=pg_catalog.clock_timestamp()`,
      )
    ).rows;
    expect(shadow.packets).toBe(0);
    const result = await createSqlResearchRetentionTick(db, {}, 1).run(
      active(),
    );
    expect(result).toMatchObject({
      status: "expired-packets-pending",
      purged_permits: 1,
      purged_packets: 2,
      expired_permits: 1,
      expired_packets: 2,
    });
  } finally {
    await client.exec(`set search_path=public`);
  }
});

it("the enclosing tick deadline is inherited inside a purger that starts late with timers starved", async () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now),
    execute = vi.fn(async () => {
      now = 9000;
    }),
    select = vi.fn(),
    database: ResearchAdmissionDatabase = {
      transaction: async (work) => work({ execute, select } as never),
    };
  try {
    const pending = createSqlResearchRetentionTick(database).run(active());
    // The tick's queued callback resumes late; the child must keep the original absolute8000 boundary.
    now = 7000;
    await expect(pending).rejects.toThrow(RESEARCH_RETENTION_ERROR);
    expect(execute).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
  } finally {
    clock.mockRestore();
  }
});

it("refuses nonfinite parent purge deadlines before any database operation", async () => {
  const database: ResearchAdmissionDatabase = { transaction: vi.fn() };
  for (const deadline of [NaN, Infinity, -Infinity, "bad"])
    await expect(
      createSqlResearchArtifactPurger(database)(
        1,
        active(),
        deadline as number,
      ),
    ).rejects.toThrow("Private research artifact storage unavailable");
  expect(database.transaction).not.toHaveBeenCalled();
});

it.each([NaN, Infinity, -Infinity, "bad"])(
  "refuses an invalid enclosing tick deadline %j before SQL",
  async (deadline) => {
    const transaction = vi.fn();
    await expect(
      createSqlResearchRetentionTick({ transaction }).run(
        active(),
        deadline as number,
      ),
    ).rejects.toThrow(RESEARCH_RETENTION_ERROR);
    expect(transaction).not.toHaveBeenCalled();
  },
);
it("inherits a shorter runner deadline into purge and refuses observation when that original deadline expires", async () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now),
    purge = vi.fn(
      async (_limit: number, _signal: AbortSignal, _deadline?: number) => {
        now = 51;
        return { permits: 0, packets: 0 };
      },
    ),
    replacement = vi
      .spyOn(artifactModule, "createSqlResearchArtifactPurger")
      .mockReturnValueOnce(purge),
    database = { transaction: vi.fn() };
  try {
    await expect(
      createSqlResearchRetentionTick(database).run(active(), 50),
    ).rejects.toThrow(RESEARCH_RETENTION_ERROR);
    expect(purge.mock.calls[0][2]).toBe(50);
    expect(database.transaction).not.toHaveBeenCalled();
  } finally {
    replacement.mockRestore();
    clock.mockRestore();
  }
});
