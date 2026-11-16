/** Explicit managed one-shot cleanup. No environment reader, cron route, publication, source content or model API. */
import "server-only";
import { createHash } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as v from "valibot";
import { createUuidV7 } from "../lib/ids";
import { parseBoundedResearchJson } from "./boundedJson";
import { withinResearchDeadline } from "./boundedWork";
import {
  prepareResearchManagedRetentionProfile,
  type ResearchManagedRetentionProfileInput,
  readResearchManagedRetentionProfile,
} from "./managedRetentionProfile";
import { createSqlResearchRetentionTick } from "./retentionWorker";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";
import {
  createSqlResearchMaintenance,
  type ResearchMaintenanceRun,
  type ResearchMaintenanceState,
} from "./sqlMaintenance";
export const RESEARCH_MANAGED_CLEANUP_ERROR =
  "Private managed research cleanup unavailable";
const fail: () => never = () => {
  throw Error(RESEARCH_MANAGED_CLEANUP_ERROR);
};
/** SQL is the durable heartbeat authority. This source-free process result never grants source/read/model access. */
export interface ResearchManagedCleanupResult {
  readonly status:
    | "healthy"
    | "pending"
    | "closed"
    | "busy"
    | "failed"
    | "unknown-final-ack";
  readonly reconciled: boolean;
}
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/)),
  identityShape = v.strictObject({
    host: v.pipe(
      v.string(),
      v.maxLength(255),
      v.regex(/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/),
      v.check((s) => !s.includes("-pooler.")),
    ),
    database: v.pipe(v.string(), v.regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/)),
    role: v.pipe(v.string(), v.regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/)),
  });
/** Dedicated direct endpoint and restricted cleanup login only. Never the broad migration credential or corpus reader. */
export interface ResearchManagedCleanupConnection
  extends v.InferInput<typeof identityShape> {
  readonly password: string;
}
/** Secret-free identity from a separately reviewed endpoint/role adoption; matching alone cannot establish actual provider custody. */
export function researchManagedCleanupConnectionIdentity(
  input: Omit<ResearchManagedCleanupConnection, "password">,
) {
  try {
    return createHash("sha256")
      .update(JSON.stringify(v.parse(identityShape, input)))
      .digest("hex");
  } catch {
    return fail();
  }
}
/** Trusted outer inputs only. The credential resolver is called after exact profile/runtime/target validation; no request supplies these fields. */
export interface ResearchManagedCleanupOptions {
  readonly documentJson: string;
  readonly independentlyAdoptedProfileSha256: string;
  readonly independentlyAdoptedConnectionSha256: string;
  readonly managedCleanupRuntime: ResearchManagedRetentionProfileInput["runtime"];
  readonly connection: () => ResearchManagedCleanupConnection;
}
/** Single bounded run. Native mutex/health cover all expired packets in the physical namespace; direct pools close before health/reconciliation. No automatic replay or schedule. */
export async function runResearchManagedCleanup(
  options: ResearchManagedCleanupOptions,
  signal: AbortSignal,
  inheritedWorkDeadlineAt?: number,
): Promise<ResearchManagedCleanupResult> {
  try {
    return await run(options, signal, inheritedWorkDeadlineAt);
  } catch {
    return fail();
  }
}
async function run(
  input: ResearchManagedCleanupOptions,
  signal: AbortSignal,
  inheritedWorkDeadlineAt?: number,
): Promise<ResearchManagedCleanupResult> {
  if (
    inheritedWorkDeadlineAt !== undefined &&
    !Number.isFinite(inheritedWorkDeadlineAt)
  )
    fail();
  const workEnd = Math.min(
    performance.now() + 40000,
    inheritedWorkDeadlineAt ?? Infinity,
  );
  if (performance.now() >= workEnd) fail();
  const workSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(Math.max(0, Math.ceil(workEnd - performance.now()))),
    ]),
    profile = readResearchManagedRetentionProfile(
      input.documentJson,
      input.independentlyAdoptedProfileSha256,
    ),
    actual = prepareResearchManagedRetentionProfile({
      ...(parseBoundedResearchJson(
        profile.document_json,
        8192,
      ) as ResearchManagedRetentionProfileInput),
      runtime: input.managedCleanupRuntime,
    });
  if (
    actual.document_json !== profile.document_json ||
    Number(process.versions.node.split(".")[0]) !== profile.runtime.node_major
  )
    fail();
  const expectedIdentity = v.parse(
    hash,
    input.independentlyAdoptedConnectionSha256,
  );
  const resolveConnection: unknown = input.connection;
  if (resolveConnection instanceof Promise)
    void resolveConnection.catch(() => {});
  if (typeof resolveConnection !== "function") fail();
  workSignal.throwIfAborted();
  if (performance.now() >= workEnd) fail();
  const resolved: unknown = resolveConnection();
  if (resolved instanceof Promise) void resolved.catch(() => {});
  if (!resolved || typeof resolved !== "object" || resolved instanceof Promise)
    fail();
  const connection = resolved as ResearchManagedCleanupConnection,
    password = connection.password,
    identity = v.parse(identityShape, {
      host: connection.host,
      database: connection.database,
      role: connection.role,
    });
  if (
    researchManagedCleanupConnectionIdentity(identity) !== expectedIdentity ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 4096 ||
    /[\0\r\n]/.test(password)
  )
    fail();
  const target = profile.target,
    expectedProfileSha256 = profile.document_sha256,
    tag = `magickli-ret-${expectedProfileSha256.slice(0, 12)}-${createUuidV7().replaceAll("-", "").slice(12)}`;
  const options = {
    max: 1,
    host: identity.host,
    port: 5432,
    database: identity.database,
    username: identity.role,
    password,
    idle_timeout: 0,
    max_lifetime: 0,
    prepare: false,
    connect_timeout: 5,
    debug: false,
    onnotice: () => {},
    connection: {
      application_name: tag + "-control",
      statement_timeout: 8000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout: 8000,
    },
  };
  const peers = new WeakMap<postgres.Sql, () => boolean>();
  function open(suffix: string) {
    let verified = false;
    const pool = postgres({
      ...options,
      ssl: {
        rejectUnauthorized: true,
        servername: identity.host,
        minVersion: "TLSv1.2",
        checkServerIdentity: (
          host: string,
          cert: Parameters<typeof checkServerIdentity>[1],
        ) => {
          if (host !== identity.host)
            return Error("Bound TLS hostname mismatch");
          const error = checkServerIdentity(host, cert);
          if (!error) verified = true;
          return error;
        },
      },
      connection: { ...options.connection, application_name: tag + suffix },
    });
    peers.set(pool, () => verified);
    return pool;
  }
  const step = <T>(
    action: (bounded: AbortSignal) => PromiseLike<T>,
    end = workEnd,
    s = workSignal,
  ) => withinResearchDeadline(s, async (bounded) => await action(bounded), end);
  async function attest(
    connection: postgres.Sql,
    end: number,
    s: AbortSignal,
    expectedPid?: number,
  ) {
    const [r] = await step(
      () =>
        connection.unsafe<
          {
            database: string;
            role: string;
            owner: string;
            privileged: boolean;
            memberships: boolean;
            pid: number;
            oid: number;
          }[]
        >(
          `select pg_catalog.current_database() as database,current_user as role,pg_catalog.pg_backend_pid() pid,
      (select pg_catalog.pg_get_userbyid(datdba) from pg_catalog.pg_database where datname=pg_catalog.current_database()) as owner,
      (select rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolreplication or rolbypassrls from pg_catalog.pg_roles where rolname=current_user) as privileged,
      exists(select 1 from pg_catalog.pg_auth_members where member=(select oid from pg_catalog.pg_roles where rolname=current_user)) as memberships,
      (select c.oid::bigint::double precision from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=$1 and c.relname='chat_research_artifacts' and c.relkind='r' and c.relpersistence='p') oid`,
          [target.storage.schemaName],
        ),
      end,
      s,
    );
    if (
      !r ||
      !peers.get(connection)?.() ||
      r.database !== identity.database ||
      r.role !== identity.role ||
      r.owner === identity.role ||
      r.privileged !== false ||
      r.memberships !== false ||
      !Number.isSafeInteger(r.pid) ||
      r.pid < 1 ||
      r.oid !== target.artifactTableOid ||
      (expectedPid !== undefined && r.pid !== expectedPid)
    )
      fail();
    return r.pid;
  }
  let controllerPool: postgres.Sql | undefined,
    packetPool: postgres.Sql | undefined,
    controller: ReturnType<typeof createSqlResearchMaintenance> | undefined,
    claim: ResearchMaintenanceRun | null = null,
    started: ResearchMaintenanceState | undefined,
    packetEnd: Promise<unknown> | undefined,
    packetClosed = false,
    controllerClosed = false,
    controllerPid: number | undefined,
    finishAttempted = false,
    result: ResearchManagedCleanupResult = {
      status: "failed",
      reconciled: false,
    };
  const closePacket = () => {
    if (!packetPool) return Promise.resolve();
    return (packetEnd ??= packetPool.end({ timeout: 5 }));
  };
  try {
    workSignal.throwIfAborted();
    if (performance.now() >= workEnd) fail();
    controllerPool = open("-control");
    const controlPid = await attest(controllerPool, workEnd, workSignal);
    controllerPid = controlPid;
    controller = createSqlResearchMaintenance(
      drizzle(controllerPool),
      {
        scope: target.scope,
        storage: target.storage,
        maintenanceSchema: target.maintenanceSchema,
        artifactTableOid: target.artifactTableOid,
        profileSha256: profile.document_sha256,
      },
      workEnd,
    );
    claim = await controller.begin(workSignal);
    if (!claim) {
      const current = await controller.inspect(workSignal);
      result = {
        status: current.state === "closed" ? "closed" : "busy",
        reconciled: false,
      };
    } else {
      await attest(controllerPool, workEnd, workSignal, controlPid);
      started = await controller.inspect(workSignal);
      if (started.state !== "started" || !started.run_id) fail();
      packetPool = open("-packet");
      const packetPid = await attest(packetPool, workEnd, workSignal);
      if (packetPid === controlPid) fail();
      const packetRoot = drizzle(packetPool),
        tickEnd = Math.min(workEnd, performance.now() + 8000),
        assertTick = () => {
          workSignal.throwIfAborted();
          if (performance.now() >= tickEnd) fail();
        },
        // The same root transaction locks and checks the original physical OID before ANY purge/observation SQL.
        // A preflight-only check would allow drop/recreate between inspection and mutation.
        fenced: ResearchAdmissionDatabase = {
          transaction: (work, config) =>
            packetRoot.transaction(async (tx) => {
              assertTick();
              await tx.execute(
                sql`lock table ${sql.identifier(target.storage.schemaName)}.chat_research_artifacts in access share mode`,
              );
              assertTick();
              const [r] = await tx
                .select({
                  oid: sql<number>`c.oid::bigint`.mapWith(Number),
                  pid: sql<number>`pg_catalog.pg_backend_pid()`,
                })
                .from(
                  sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
                )
                .where(
                  sql`n.nspname=${target.storage.schemaName} and c.relname='chat_research_artifacts' and c.relkind='r' and c.relpersistence='p'`,
                );
              assertTick();
              if (r?.oid !== target.artifactTableOid || r.pid !== packetPid)
                fail();
              return work(tx);
            }, config),
        };
      const tick = await createSqlResearchRetentionTick(
        fenced,
        target.storage,
        100,
      ).run(workSignal, tickEnd);
      await step(closePacket);
      // Postgres end ACK can precede server backend removal by a few milliseconds.
      const goneEnd = Math.min(workEnd, performance.now() + 5000);
      do {
        await attest(controllerPool, goneEnd, workSignal, controlPid);
        const [r] = await step(
          () =>
            controllerPool!.unsafe<{ gone: boolean }[]>(
              `select not exists(select 1 from pg_catalog.pg_stat_activity where pid=$1) gone`,
              [packetPid],
            ),
          goneEnd,
        );
        if (r?.gone === true) {
          packetClosed = true;
          break;
        }
        await step(
          () => new Promise<void>((resolve) => setTimeout(resolve, 10)),
          goneEnd,
        );
      } while (performance.now() < goneEnd);
      if (!packetClosed) fail();
      finishAttempted = true;
      const completed = await controller.finish(
        claim,
        { permits: tick.purged_permits, packets: tick.purged_packets },
        workSignal,
      );
      result = {
        status: completed.state as "healthy" | "pending" | "closed",
        reconciled: false,
      };
    }
  } catch {
    result = {
      status: finishAttempted ? "unknown-final-ack" : "failed",
      reconciled: false,
    };
  } finally {
    // One independent teardown allowance; cancellation/work timeout never restarts normal packet work.
    const teardownEnd = performance.now() + 15000,
      teardownSignal = new AbortController().signal;
    let resourceFailure = false;
    try {
      const pending = closePacket();
      void pending.catch(() => {});
      await step(() => pending, teardownEnd, teardownSignal);
    } catch {
      resourceFailure = true;
    }
    if (claim && controller && !finishAttempted) {
      try {
        await step(
          (bounded) => controller!.fail(claim!, bounded, teardownEnd),
          teardownEnd,
          teardownSignal,
        );
      } catch {
        /* Started/failed remains nonhealthy; never replay a packet attempt. */
      }
    }
    if (controller)
      try {
        await step(
          () => controller!.release(teardownEnd),
          teardownEnd,
          teardownSignal,
        );
      } catch {
        resourceFailure = true;
      }
    if (controllerPool)
      try {
        // Initiate actual closure even if the remaining wait budget is already exhausted.
        const pending = controllerPool.end({ timeout: 5 });
        void pending.catch(() => {});
        await step(() => pending, teardownEnd, teardownSignal);
        controllerClosed = true;
      } catch {
        resourceFailure = true;
      }
    if (
      result.status === "unknown-final-ack" &&
      packetClosed &&
      controllerClosed &&
      started?.run_id &&
      !resourceFailure
    ) {
      // Only after the original pool drains/closes: a new read-only controller can reconcile its exact committed run.
      let observer: postgres.Sql | undefined,
        inspection: ReturnType<typeof createSqlResearchMaintenance> | undefined,
        observed: ResearchMaintenanceState | undefined;
      try {
        observer = open("-reconcile");
        await attest(observer, teardownEnd, teardownSignal);
        const [settled] = await step(
          () =>
            observer!.unsafe<{ gone: boolean }[]>(
              "select not exists(select 1 from pg_catalog.pg_stat_activity where pid=$1) gone",
              [controllerPid!],
            ),
          teardownEnd,
          teardownSignal,
        );
        if (settled?.gone !== true) fail();
        inspection = createSqlResearchMaintenance(
          drizzle(observer),
          {
            scope: target.scope,
            storage: target.storage,
            maintenanceSchema: target.maintenanceSchema,
            artifactTableOid: target.artifactTableOid,
            profileSha256: profile.document_sha256,
          },
          teardownEnd,
        );
        observed = await inspection.inspect(teardownSignal);
        if (
          observed.run_id !== started.run_id ||
          observed.revision !== started.revision + 1 ||
          !["healthy", "pending", "closed"].includes(observed.state)
        )
          observed = undefined;
      } catch {
        observed = undefined;
      } finally {
        if (inspection)
          try {
            await step(
              () => inspection!.release(teardownEnd),
              teardownEnd,
              teardownSignal,
            );
          } catch {
            resourceFailure = true;
          }
        if (observer)
          try {
            const pending = observer.end({ timeout: 5 });
            void pending.catch(() => {});
            await step(() => pending, teardownEnd, teardownSignal);
          } catch {
            resourceFailure = true;
          }
      }
      if (observed && !resourceFailure)
        result = {
          status: observed.state as "healthy" | "pending" | "closed",
          reconciled: true,
        };
    }
    if (resourceFailure) result = { status: "failed", reconciled: false };
  }
  return Object.freeze(result);
}
