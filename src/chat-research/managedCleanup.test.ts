/** Scripted reached lifecycle controls. No socket, real credential, SQL backend or cleanup schedule. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  RESEARCH_MANAGED_CLEANUP_ERROR,
  type ResearchManagedCleanupOptions,
  researchManagedCleanupConnectionIdentity,
  runResearchManagedCleanup,
} from "./managedCleanup";
import { managedPublicationFixture } from "./managedPublication.fixture";
import { prepareResearchManagedRetentionProfile } from "./managedRetentionProfile";

const fake = vi.hoisted(() => ({
  events: [] as string[],
  pools: [] as {
    pid: number;
    closed: boolean;
    end: ReturnType<typeof vi.fn>;
  }[],
  poolOptions: [] as Record<string, unknown>[],
  busy: false,
  badPeer: false,
  privileged: false,
  memberships: false,
  ownsAnything: false,
  noLogin: false,
  roleOid: 321,
  wrongRole: false,
  replacedOid: false,
  packetCloseFails: false,
  finishAckLost: false,
  observerRunWrong: false,
  gone: true,
  controlGone: true,
  controllerPid: 10,
  packetPid: 20,
  goneMisses: 0,
  startedBad: false,
  releaseFailure: "",
  endFailurePid: 0,
}));
vi.mock("server-only", () => ({}));
vi.mock("postgres", () => ({
  default: vi.fn((options) => {
    const index = fake.pools.length,
      pid =
        index === 0 ? fake.controllerPid : index === 1 ? fake.packetPid : 30;
    fake.poolOptions.push(options);
    const pool = {
      pid,
      closed: false,
      end: vi.fn(async () => {
        fake.events.push(`close:${pid}`);
        if (pid === fake.endFailurePid) throw Error("Synthetic end refusal");
        if (pid === fake.packetPid && fake.packetCloseFails)
          throw Error("Synthetic close failure");
        pool.closed = true;
      }),
    };
    fake.pools.push(pool);
    // Exercise the actual bound-host callback; the scripted certificate is not an actual TLS handshake.
    options.onnotice({ message: "Synthetic suppressed private notice" });
    options.ssl.checkServerIdentity(
      fake.badPeer ? "wrong.example" : options.host,
      { subjectaltname: `DNS:${options.host}` },
    );
    return {
      ...pool,
      end: pool.end,
      unsafe: vi.fn(async (query: string, params?: unknown[]) => {
        if (query.includes("pg_stat_activity")) {
          fake.events.push("native-packet-absence");
          return [
            {
              gone:
                params?.[0] === fake.controllerPid
                  ? fake.controlGone
                  : fake.goneMisses-- > 0
                    ? false
                    : fake.gone,
            },
          ];
        }
        throw Error("Unexpected unfenced raw catalog query");
      }),
    };
  }),
}));
vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn((pool) => ({
    select: () => ({
      from: () => ({
        where: async () => {
          fake.events.push(`attest:${pool.pid}`);
          return [
            {
              database: "synthetic_research",
              role: fake.wrongRole ? "wrong_role" : "synthetic_cleanup",
              roleOid: fake.roleOid,
              unsafeRole:
                fake.privileged ||
                fake.memberships ||
                fake.ownsAnything ||
                fake.noLogin,
              pid: pool.pid,
              oid: 1234,
            },
          ];
        },
      }),
    }),
    transaction: async (work: (tx: unknown) => unknown) =>
      work({
        execute: vi.fn(async () => {}),
        select: () => ({
          from: () => ({
            where: async () => [
              { oid: fake.replacedOid ? 5678 : 1234, pid: pool.pid },
            ],
          }),
        }),
      }),
  })),
}));
vi.mock("./retentionWorker", () => ({
  createSqlResearchRetentionTick: vi.fn((db) => ({
    run: vi.fn(async () => {
      fake.events.push("purge-start");
      await db.transaction(async () => {});
      fake.events.push("purge-finished");
      return { purged_permits: 1, purged_packets: 2 };
    }),
  })),
}));
vi.mock("./sqlMaintenance", () => ({
  createSqlResearchMaintenance: vi.fn(() => {
    const isObserver = fake.pools.length > 2;
    return {
      begin: vi.fn(async () => {
        fake.events.push("begin");
        return fake.busy ? null : { kind: "private_research_maintenance_run" };
      }),
      inspect: vi.fn(async () => {
        fake.events.push(
          isObserver ? "observe-committed-run" : "inspect-started",
        );
        return {
          state: isObserver
            ? "healthy"
            : fake.startedBad
              ? "healthy"
              : "started",
          run_id: fake.observerRunWrong && isObserver ? "wrong" : "same-run",
          revision: isObserver ? 2 : 1,
        };
      }),
      finish: vi.fn(async () => {
        fake.events.push("finish");
        if (fake.finishAckLost) throw Error("Synthetic lost final ACK");
        return { state: "healthy" };
      }),
      fail: vi.fn(async () => {
        fake.events.push("fail-nonhealthy");
      }),
      release: vi.fn(async () => {
        fake.events.push("release");
        if (fake.releaseFailure === (isObserver ? "observer" : "control"))
          throw Error("Synthetic release refusal");
      }),
    };
  }),
}));
const identity = {
  host: "ep-synthetic-test.eu-west-2.aws.neon.tech",
  database: "synthetic_research",
  role: "synthetic_cleanup",
};
function options(): ResearchManagedCleanupOptions {
  const f = managedPublicationFixture(),
    runtime = { ...f.profileInput.runtime, node_major: 24 as const },
    profile = prepareResearchManagedRetentionProfile({
      ...f.profileInput,
      runtime,
    });
  return {
    documentJson: profile.document_json,
    independentlyAdoptedProfileSha256: profile.document_sha256,
    managedCleanupRuntime: runtime,
    independentlyAdoptedRoleOid: 321,
    independentlyAdoptedConnectionSha256:
      researchManagedCleanupConnectionIdentity(identity),
    connection: vi.fn(() => ({ ...identity, password: "a".repeat(64) })),
  };
}
beforeEach(() => {
  Object.assign(fake, {
    events: [],
    pools: [],
    poolOptions: [],
    busy: false,
    badPeer: false,
    privileged: false,
    memberships: false,
    ownsAnything: false,
    noLogin: false,
    roleOid: 321,
    wrongRole: false,
    replacedOid: false,
    packetCloseFails: false,
    finishAckLost: false,
    observerRunWrong: false,
    gone: true,
    controlGone: true,
    controllerPid: 10,
    packetPid: 20,
    goneMisses: 0,
    startedBad: false,
    releaseFailure: "",
    endFailurePid: 0,
  });
  vi.clearAllMocks();
});
const active = () => new AbortController().signal;
it("does not resolve credentials or connect before exact profile/runtime/connection adoption", async () => {
  for (const change of [
    { independentlyAdoptedProfileSha256: "f".repeat(64) },
    { independentlyAdoptedConnectionSha256: "bad" },
    { independentlyAdoptedRoleOid: 0 },
    { independentlyAdoptedRoleOid: Number.NaN },
    {
      managedCleanupRuntime: {
        ...options().managedCleanupRuntime,
        project_scope_sha256: "f".repeat(64),
      },
    },
  ]) {
    const o = options();
    await expect(
      runResearchManagedCleanup({ ...o, ...change }, active()),
    ).rejects.toThrow(RESEARCH_MANAGED_CLEANUP_ERROR);
    expect(o.connection).not.toHaveBeenCalled();
  }
  expect(fake.pools).toEqual([]);
});
it("requires a direct verified Neon target and the exact separately adopted nonsecret identity", async () => {
  expect(() =>
    researchManagedCleanupConnectionIdentity({
      ...identity,
      host: identity.host.replace(".eu-", "-pooler.eu-"),
    }),
  ).toThrow();
  const o = options();
  await expect(
    runResearchManagedCleanup(
      {
        ...o,
        connection: () => ({
          ...identity,
          role: "other_role",
          password: "a".repeat(64),
        }),
      },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_MANAGED_CLEANUP_ERROR);
  expect(fake.pools).toEqual([]);
});
it("finishes health only after the packet pool closes and native PID absence is observed", async () => {
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "healthy",
    reconciled: false,
  });
  expect(fake.events.indexOf("finish")).toBeGreaterThan(
    fake.events.indexOf("close:20"),
  );
  expect(fake.events.indexOf("finish")).toBeGreaterThan(
    fake.events.indexOf("native-packet-absence"),
  );
  expect(fake.pools.every((p) => p.closed)).toBe(true);
  expect(fake.pools[1].end).toHaveBeenCalledTimes(1);
  for (const o of fake.poolOptions) {
    expect(o).toMatchObject({
      max: 1,
      idle_timeout: 0,
      max_lifetime: 0,
      debug: false,
      ssl: {
        rejectUnauthorized: true,
        servername: identity.host,
        minVersion: "TLSv1.2",
      },
    });
  }
});
it.each([
  "badPeer",
  "privileged",
  "memberships",
  "wrongRole",
  "ownsAnything",
  "noLogin",
] as const)("refuses native %s before acquisition or purge", async (flag) => {
  fake[flag] = true;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "failed",
    reconciled: false,
  });
  expect(fake.events).not.toContain("begin");
  expect(fake.events).not.toContain("purge-start");
  expect(fake.pools.every((p) => p.closed)).toBe(true);
});
it("does not start packet work when the physical target mutex is busy", async () => {
  fake.busy = true;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "busy",
    reconciled: false,
  });
  expect(fake.pools).toHaveLength(1);
  expect(fake.events).not.toContain("purge-start");
});
it("refuses replaced artifact identity inside the actual packet transaction before purge work", async () => {
  fake.replacedOid = true;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "failed",
    reconciled: false,
  });
  expect(fake.events).not.toContain("purge-finished");
  expect(fake.events).not.toContain("finish");
  expect(fake.events).toContain("fail-nonhealthy");
});
it("cannot finish or reconcile after unconfirmed packet closure", async () => {
  fake.packetCloseFails = true;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "failed",
    reconciled: false,
  });
  expect(fake.events).not.toContain("finish");
  expect(fake.pools).toHaveLength(2);
  expect(fake.pools[1].end).toHaveBeenCalledTimes(1);
});
it("reconciles only the same native committed run after both original pools close", async () => {
  fake.finishAckLost = true;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "healthy",
    reconciled: true,
  });
  expect(fake.events.indexOf("observe-committed-run")).toBeGreaterThan(
    fake.events.indexOf("close:10"),
  );
  expect(fake.events.indexOf("observe-committed-run")).toBeGreaterThan(
    fake.events.indexOf("close:20"),
  );
  expect(fake.pools.every((p) => p.closed)).toBe(true);
});
it("keeps an unknown final acknowledgement when the fresh observer finds another run", async () => {
  fake.finishAckLost = true;
  fake.observerRunWrong = true;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "unknown-final-ack",
    reconciled: false,
  });
});
it("refuses cancellation before a credential or pool exists", async () => {
  const o = options(),
    controller = new AbortController();
  controller.abort();
  await expect(runResearchManagedCleanup(o, controller.signal)).rejects.toThrow(
    RESEARCH_MANAGED_CLEANUP_ERROR,
  );
  expect(o.connection).not.toHaveBeenCalled();
  expect(fake.pools).toEqual([]);
});

it("does not reconcile while the original controller backend remains visible", async () => {
  fake.finishAckLost = true;
  fake.controlGone = false;
  expect(await runResearchManagedCleanup(options(), active())).toEqual({
    status: "unknown-final-ack",
    reconciled: false,
  });
  expect(fake.events).not.toContain("observe-committed-run");
});
it("keeps an inherited expired work deadline before credentials or pools", async () => {
  const o = options();
  await expect(
    runResearchManagedCleanup(o, active(), performance.now() - 1),
  ).rejects.toThrow(RESEARCH_MANAGED_CLEANUP_ERROR);
  expect(o.connection).not.toHaveBeenCalled();
  expect(fake.pools).toEqual([]);
});
it("refuses a self-consistent Node22 configuration under the actual Node24 app before credentials", async () => {
  const o = options(),
    profile = prepareResearchManagedRetentionProfile({
      ...JSON.parse(o.documentJson),
      runtime: { ...o.managedCleanupRuntime, node_major: 22 },
    });
  await expect(
    runResearchManagedCleanup(
      {
        ...o,
        documentJson: profile.document_json,
        independentlyAdoptedProfileSha256: profile.document_sha256,
        managedCleanupRuntime: profile.runtime,
      },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_MANAGED_CLEANUP_ERROR);
  expect(o.connection).not.toHaveBeenCalled();
  expect(fake.pools).toEqual([]);
});

afterEach(() => vi.restoreAllMocks());
it("does not resolve credentials when profile processing crosses the inherited deadline", async () => {
  const o = options(),
    end = performance.now() + 100;
  let expired = false;
  vi.spyOn(performance, "now").mockImplementation(() =>
    expired ? end + 1 : end - 1,
  );
  const late = {
    ...o,
    get managedCleanupRuntime() {
      expired = true;
      return o.managedCleanupRuntime;
    },
  };
  await expect(runResearchManagedCleanup(late, active(), end)).rejects.toThrow(
    RESEARCH_MANAGED_CLEANUP_ERROR,
  );
  expect(expired).toBe(true);
  expect(o.connection).not.toHaveBeenCalled();
  expect(fake.pools).toEqual([]);
});

it("captures the resolver before the final live check so its getter cannot extend the credential budget", async () => {
  const o = options(),
    end = performance.now() + 100;
  let expired = false;
  vi.spyOn(performance, "now").mockImplementation(() =>
    expired ? end + 1 : end - 1,
  );
  const late = {
    ...o,
    get connection() {
      expired = true;
      return o.connection;
    },
  };
  await expect(runResearchManagedCleanup(late, active(), end)).rejects.toThrow(
    RESEARCH_MANAGED_CLEANUP_ERROR,
  );
  expect(expired).toBe(true);
  expect(o.connection).not.toHaveBeenCalled();
  expect(fake.pools).toEqual([]);
});

it("rejects an accidental async credential resolver without an unhandled private diagnostic", async () => {
  const o = options(),
    rejected = Promise.reject(Error("Synthetic private credential diagnostic")),
    observed = vi.spyOn(rejected, "catch");
  await expect(
    runResearchManagedCleanup(
      { ...o, connection: (() => rejected) as never },
      active(),
    ),
  ).rejects.toThrow(RESEARCH_MANAGED_CLEANUP_ERROR);
  expect(observed).toHaveBeenCalledTimes(1);
  expect(fake.pools).toEqual([]);
});

it("refuses a promise-valued credential resolver without an unhandled private rejection", async () => {
  const o = options();
  Object.defineProperty(o, "connection", {
    value: Promise.reject(Error("synthetic private resolver diagnostic")),
  });
  await expect(runResearchManagedCleanup(o, active())).rejects.toThrow(
    RESEARCH_MANAGED_CLEANUP_ERROR,
  );
  expect(fake.pools).toHaveLength(0);
});
it("rejects nonfinite inherited work bounds before credentials", async () => {
  const o = options();
  await expect(runResearchManagedCleanup(o, active(), NaN)).rejects.toThrow();
  expect(o.connection).not.toHaveBeenCalled();
});
it("waits for a just-closed packet backend to disappear before finishing health", async () => {
  fake.goneMisses = 1;
  expect((await runResearchManagedCleanup(options(), active())).status).toBe(
    "healthy",
  );
  expect(fake.events.filter((e) => e === "native-packet-absence")).toHaveLength(
    2,
  );
});
it.each(["control", "observer"])(
  "cannot report health after %s release acknowledgement fails",
  async (which) => {
    fake.releaseFailure = which;
    if (which === "observer") fake.finishAckLost = true;
    expect((await runResearchManagedCleanup(options(), active())).status).toBe(
      "failed",
    );
  },
);
it.each([10, 30])(
  "cannot report health after actual pool %s closure fails",
  async (pid) => {
    fake.endFailurePid = pid;
    if (pid === 30) fake.finishAckLost = true;
    expect((await runResearchManagedCleanup(options(), active())).status).toBe(
      "failed",
    );
  },
);
it("requires the acknowledged started state before opening a packet pool", async () => {
  fake.startedBad = true;
  expect((await runResearchManagedCleanup(options(), active())).status).toBe(
    "failed",
  );
  expect(fake.pools).toHaveLength(1);
  expect(fake.events).not.toContain("purge-start");
});
it("refuses sharing the control and packet backend identity", async () => {
  fake.packetPid = fake.controllerPid;
  expect((await runResearchManagedCleanup(options(), active())).status).toBe(
    "failed",
  );
  expect(fake.events).not.toContain("purge-start");
});
it("does not open any socket if a delayed password getter exhausts the work budget", async () => {
  const o = options(),
    clock = vi.spyOn(performance, "now").mockReturnValue(0);
  Object.defineProperty(o, "connection", {
    value: () => ({
      ...identity,
      get password() {
        clock.mockReturnValue(40001);
        return "a".repeat(64);
      },
    }),
  });
  expect((await runResearchManagedCleanup(o, active())).status).toBe("failed");
  expect(fake.pools).toHaveLength(0);
});

it("refuses a recreated cleanup role before acquiring maintenance or opening the packet pool", async () => {
  fake.roleOid = 322;
  expect((await runResearchManagedCleanup(options(), active())).status).toBe(
    "failed",
  );
  expect(fake.events).not.toContain("begin");
  expect(fake.pools).toHaveLength(1);
  expect(fake.pools[0].closed).toBe(true);
});
