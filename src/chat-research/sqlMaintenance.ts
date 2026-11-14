/** Inactive dedicated-session maintenance ledger. No seed/publication, schedule, env reader, provider or source grant. */
import "server-only";
import { eq, is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { chatResearchMaintenance as maintenance } from "../db/schema/chatResearchMaintenance";
import { createUuidV7 } from "../lib/ids";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  prepareResearchMaintenanceTarget,
  RESEARCH_MAINTENANCE_ERROR,
  RESEARCH_MAINTENANCE_LEASE_MS,
  RESEARCH_MAINTENANCE_LOCK_PREFIX,
  RESEARCH_MAINTENANCE_STALE_MS,
  RESEARCH_PACKET_PURGE_LAG_MS,
  type ResearchMaintenanceTargetInput,
} from "./maintenanceTarget";
import type {
  ResearchAdmissionDatabase,
  ResearchAdmissionTransaction,
} from "./sqlAdmission";
import { lockResearchArtifacts } from "./sqlArtifacts";

function fail(): never {
  throw Error(RESEARCH_MAINTENANCE_ERROR);
}
type Row = typeof maintenance.$inferSelect;
/** Store-local acknowledged run identity. It is not a model, source, processing or completed-answer capability. */
export interface ResearchMaintenanceRun {
  readonly kind: "private_research_maintenance_run";
}
/** Source-free durable state only. Freshness is operational evidence, never a source grant. */
export interface ResearchMaintenanceState {
  readonly profile_sha256: string;
  readonly target_sha256: string;
  readonly revision: number;
  readonly state: Row["state"];
  readonly run_id: string | null;
  readonly observed_at_ms: number | null;
  readonly fresh: boolean;
  readonly expired_permits: number | null;
  readonly expired_packets: number | null;
  readonly unpurged_packets: number | null;
  readonly latest_retain_until_ms: number | null;
}
const table = (ns: string, name: string) =>
  sql`${sql.identifier(ns)}.${sql.identifier(name)}`;
/**
 * Supply a supported Drizzle root over an exclusive single-connection pool (no other borrowers/idle or lifetime expiry),
 * or a supported reserved-session root; never a shared pool or outer transaction. Native PID/lock/GUC checks reject
 * switched sessions; the outer runner must always close its actual pool after release,
 * including unknown acquisition/commit/unlock ACKs. No packet work may precede acknowledged begin().
 * An inherited absolute monotonic work deadline can only shorten every normal operation; release retains its independent teardown bound.
 */
export function createSqlResearchMaintenance(
  database: ResearchAdmissionDatabase,
  input: ResearchMaintenanceTargetInput,
  workDeadlineAt?: number,
) {
  try {
    if (
      is(database, PgTransaction) ||
      "rollback" in database ||
      (workDeadlineAt !== undefined &&
        (typeof workDeadlineAt !== "number" ||
          !Number.isFinite(workDeadlineAt)))
    )
      fail();
    const target = prepareResearchMaintenanceTarget(input),
      namespace = target.storage.schemaName,
      m = table(target.maintenanceSchema, "chat_research_maintenance"),
      w = table(namespace, "chat_research_windows"),
      a = table(namespace, "chat_research_artifacts"),
      nonce = createUuidV7(),
      guc = `magickli_retention.o${target.artifactTableOid}`;
    let attempted = false,
      acquired = false,
      lockAcknowledged = false,
      consumed = false,
      released = false,
      backendPid: number | undefined,
      lockKey: string | undefined;
    const claims = new WeakMap<object, { revision: number }>();
    const teardown = new AbortController(),
      transactions = new Set<Promise<unknown>>();
    let operationDone: Promise<void> | undefined;
    function operate<T>(work: () => Promise<T>): Promise<T> {
      if (released || operationDone) fail();
      let resolve!: () => void;
      operationDone = new Promise<void>((r) => {
        resolve = r;
      });
      return work()
        .then((value) => {
          if (released) fail();
          return value;
        })
        .finally(() => {
          operationDone = undefined;
          resolve();
        });
    }

    const scope = target.scope;
    const windowFence = sql`w.id=${scope.windowId}::uuid and w.approval_sha256=${scope.approvalSha256} and w.actor_id=${scope.actorId}::uuid and w.corpus_version=${scope.corpusVersion} and w.model=${scope.model} and w.processor_profile=${scope.processorProfile} and w.begins_at=to_timestamp(${scope.beginsAtMs}::double precision/1000) and w.expires_at=to_timestamp(${scope.expiresAtMs}::double precision/1000) and w.max_requests=${scope.maxRequests} and w.per_request_pico=${scope.perRequestPico} and w.total_pico=${scope.totalPico}`;
    const ownRow = (row: Row | undefined) => {
      if (
        !row ||
        row.profileSha256 !== target.profileSha256 ||
        row.targetSha256 !== target.targetSha256 ||
        row.artifactSchema !== namespace ||
        row.artifactTableOid !== target.artifactTableOid ||
        row.publicationCutoff.getTime() !== target.publicationCutoffMs ||
        row.coverageThrough.getTime() !== target.coverageThroughMs ||
        !Number.isSafeInteger(row.revision) ||
        row.revision < 1 ||
        row.revision > Number.MAX_SAFE_INTEGER
      )
        fail();
      return row;
    };
    const held = () => {
      if (backendPid === undefined || lockKey === undefined) fail();
      return sql`pg_catalog.pg_backend_pid()=${backendPid} and pg_catalog.current_setting(${guc},true)=${nonce} and exists(select 1 from pg_catalog.pg_locks l where l.locktype='advisory' and l.pid=pg_catalog.pg_backend_pid() and l.granted and l.classid=((${lockKey}::bigint>>32)&4294967295)::oid and l.objid=(${lockKey}::bigint&4294967295)::oid and l.objsubid=1)`;
    };
    type Step = <T>(action: () => PromiseLike<T>) => Promise<T>;
    async function root<T>(
      signal: AbortSignal,
      work: (
        tx: ResearchAdmissionTransaction,
        step: Step,
        assert: () => void,
      ) => Promise<T>,
      readOnly = false,
      lockTables = true,
      parentDeadlineAt?: number,
      closing = false,
    ): Promise<T> {
      const end = Math.min(
        performance.now() + RESEARCH_OPERATION_TIMEOUT_MS,
        parentDeadlineAt ?? Infinity,
        closing ? Infinity : (workDeadlineAt ?? Infinity),
      );
      try {
        return await withinResearchDeadline(
          closing ? signal : AbortSignal.any([signal, teardown.signal]),
          async (bounded) => {
            const assert = () => {
              bounded.throwIfAborted();
              if (performance.now() >= end) fail();
            };
            const step: Step = async (action) => {
              assert();
              const value = await action();
              assert();
              return value;
            };
            assert();
            const pending = database.transaction(
              async (tx) => {
                await step(() => tx.execute(sql`set local lock_timeout='5s'`));
                await step(() =>
                  tx.execute(sql`set local statement_timeout='8s'`),
                );
                await step(() =>
                  tx.execute(
                    sql`set local search_path=pg_catalog,${sql.identifier(target.maintenanceSchema)},pg_temp`,
                  ),
                );
                const [mode] = await step(() =>
                  tx
                    .select({
                      pid: sql<number>`pg_catalog.pg_backend_pid()`,
                      isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
                      readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
                    })
                    .from(sql`(select 1) maintenance_mode`),
                );
                if (
                  !mode ||
                  !Number.isSafeInteger(mode.pid) ||
                  mode.pid < 1 ||
                  mode.isolation !== "read committed" ||
                  mode.readOnly !== (readOnly ? "on" : "off") ||
                  (backendPid !== undefined && mode.pid !== backendPid)
                )
                  fail();
                if (lockTables) {
                  await step(() =>
                    tx.execute(sql`lock table ${m},${w} in access share mode`),
                  );
                  await step(() =>
                    lockResearchArtifacts(tx, namespace, assert),
                  );
                  const durable = await step(() =>
                    tx
                      .select({
                        name: sql<string>`c.relname`,
                        namespace: sql<string>`n.nspname`,
                        oid: sql<number>`c.oid::bigint`.mapWith(Number),
                      })
                      .from(
                        sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
                      )
                      .where(
                        sql`((n.nspname=${target.maintenanceSchema} and c.relname='chat_research_maintenance') or (n.nspname=${namespace} and c.relname in ('chat_research_windows','chat_research_artifacts'))) and c.relkind='r' and c.relpersistence='p'`,
                      ),
                  );
                  if (
                    durable.length !== 3 ||
                    durable.find(
                      (row) =>
                        row.namespace === namespace &&
                        row.name === "chat_research_artifacts",
                    )?.oid !== target.artifactTableOid
                  )
                    fail();
                }
                const output = await work(tx, step, assert);
                assert();
                return output;
              },
              {
                isolationLevel: "read committed",
                accessMode: readOnly ? "read only" : "read write",
              },
            );
            transactions.add(pending);
            void pending.then(
              () => transactions.delete(pending),
              () => transactions.delete(pending),
            );
            const result = await pending;
            assert();
            return result;
          },
          end,
        );
      } catch {
        return fail();
      }
    }
    async function current(
      tx: ResearchAdmissionTransaction,
      step: Step,
      forUpdate = false,
    ) {
      const query = tx
        .select()
        .from(maintenance)
        .where(eq(maintenance.profileSha256, target.profileSha256));
      const rows = await step(() => (forUpdate ? query.for("update") : query));
      return ownRow(rows[0]);
    }
    const clock = async (tx: ResearchAdmissionTransaction, step: Step) => {
      const [r] = await step(() =>
        tx
          .select({
            now: sql<number>`pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::double precision`,
          })
          .from(sql`(select 1) maintenance_clock`),
      );
      if (!r || !Number.isSafeInteger(r.now) || r.now < 0) fail();
      return r.now;
    };
    async function requireHeld(tx: ResearchAdmissionTransaction, step: Step) {
      const [r] = await step(() =>
        tx
          .select({ held: sql<boolean>`${held()}` })
          .from(sql`(select 1) maintenance_ownership`),
      );
      if (!r?.held) fail();
    }
    async function activeRun(
      tx: ResearchAdmissionTransaction,
      step: Step,
      claim: ResearchMaintenanceRun,
    ) {
      if (released || !acquired) fail();
      const bound = claims.get(claim);
      if (!bound) fail();
      await requireHeld(tx, step);
      const row = await current(tx, step, true),
        now = await clock(tx, step);
      if (
        row.state !== "started" ||
        row.runId !== nonce ||
        row.revision !== bound.revision ||
        row.controllerPid !== backendPid ||
        !row.leaseExpiresAt ||
        now >= row.leaseExpiresAt.getTime()
      )
        fail();
      return { row, now, bound };
    }
    const projection = (row: Row, now: number): ResearchMaintenanceState => ({
      profile_sha256: row.profileSha256,
      target_sha256: row.targetSha256,
      revision: row.revision,
      state: row.state,
      run_id: row.runId,
      observed_at_ms: row.observedAt?.getTime() ?? null,
      fresh:
        row.state === "healthy" &&
        row.observedAt !== null &&
        Number.isSafeInteger(row.observedAt.getTime()) &&
        now >= row.observedAt.getTime() &&
        now - row.observedAt.getTime() < RESEARCH_MAINTENANCE_STALE_MS,
      expired_permits: row.expiredPermits,
      expired_packets: row.expiredPackets,
      unpurged_packets: row.unpurgedPackets,
      latest_retain_until_ms: row.latestRetainUntil?.getTime() ?? null,
    });
    const methods = {
      /** One exclusive physical-target session lock and durably ACKed started state. Null is busy/closed, never permission to purge. */
      async begin(signal: AbortSignal): Promise<ResearchMaintenanceRun | null> {
        if (consumed || released) fail();
        consumed = true;
        const end = performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
        const opened = await root(
          signal,
          async (tx, step) => {
            if ((await current(tx, step)).state === "closed") return false;
            const [identity] = await step(() =>
              tx
                .select({
                  pid: sql<number>`pg_catalog.pg_backend_pid()`,
                  oid: sql<number>`c.oid::bigint`.mapWith(Number),
                  key: sql<string>`pg_catalog.hashtextextended(${RESEARCH_MAINTENANCE_LOCK_PREFIX}||c.oid::text,0)::text`,
                })
                .from(
                  sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
                )
                .where(
                  sql`n.nspname=${namespace} and c.relname='chat_research_artifacts' and c.relkind='r' and c.relpersistence='p'`,
                ),
            );
            if (
              !identity ||
              identity.oid !== target.artifactTableOid ||
              !Number.isSafeInteger(identity.pid) ||
              identity.pid < 1 ||
              typeof identity.key !== "string" ||
              !/^[-]?[0-9]{1,20}$/.test(identity.key) ||
              BigInt(identity.key) < BigInt("-9223372036854775808") ||
              BigInt(identity.key) >= BigInt("9223372036854775808")
            )
              fail();
            backendPid = identity.pid;
            lockKey = identity.key;
            attempted = true;
            const self = sql`exists(select 1 from pg_catalog.pg_locks l where l.locktype='advisory' and l.pid=pg_catalog.pg_backend_pid() and l.granted and l.classid=((${lockKey}::bigint>>32)&4294967295)::oid and l.objid=(${lockKey}::bigint&4294967295)::oid and l.objsubid=1)`;
            const [lock] = await step(() =>
              tx
                .select({
                  ok: sql<boolean>`case when ${self} then false when pg_catalog.pg_try_advisory_lock(${lockKey}::bigint) then pg_catalog.set_config(${guc},${nonce},false)=${nonce} else false end`,
                })
                .from(sql`(select 1) maintenance_acquire`),
            );
            lockAcknowledged = true;
            if (!lock?.ok) return false;
            acquired = true;
            return true;
          },
          false,
          true,
          end,
        );
        if (!opened) return null;
        // A committed acquisition keeps the session GUC across any later heartbeat rollback.
        const row = await root(
          signal,
          async (tx, step) => {
            await requireHeld(tx, step);
            const old = await current(tx, step, true);
            if (old.state === "closed") return null;
            const now = await clock(tx, step);
            const [updated] = await step(() =>
              tx
                .update(maintenance)
                .set({
                  state: "started",
                  controllerPid: backendPid,
                  runId: nonce,
                  startedAt: new Date(now),
                  leaseExpiresAt: new Date(now + RESEARCH_MAINTENANCE_LEASE_MS),
                  observedAt: null,
                  finishedAt: null,
                  expiredPermits: null,
                  expiredPackets: null,
                  unpurgedPackets: null,
                  latestRetainUntil: null,
                  purgedPermits: null,
                  purgedPackets: null,
                })
                .where(
                  sql`${maintenance.profileSha256}=${target.profileSha256} and ${maintenance.revision}=${old.revision}`,
                )
                .returning(),
            );
            const value = ownRow(updated);
            if (
              value.revision !== old.revision + 1 ||
              value.runId !== nonce ||
              value.state !== "started"
            )
              fail();
            return value;
          },
          false,
          true,
          end,
        );
        if (!row) return null;
        if (released) fail();
        const claim: ResearchMaintenanceRun = Object.freeze({
          kind: "private_research_maintenance_run",
        });
        claims.set(claim, { revision: row.revision });
        return claim;
      },
      /** Caller must first confirm its separate packet-worker pool closed. Fresh native counts, not caller-shaped health, decide the state. */
      async finish(
        claim: ResearchMaintenanceRun,
        removed: { permits: number; packets: number },
        signal: AbortSignal,
      ): Promise<ResearchMaintenanceState> {
        if (
          !removed ||
          Object.keys(removed).sort().join(",") !== "packets,permits" ||
          !Number.isSafeInteger(removed.permits) ||
          removed.permits < 0 ||
          removed.permits > 100 ||
          !Number.isSafeInteger(removed.packets) ||
          removed.packets < 0 ||
          removed.packets > 200
        )
          fail();
        if (released || !acquired || !claims.has(claim)) fail();
        const counts = { ...removed };
        const result = await root(signal, async (tx, step) => {
          const { row, bound } = await activeRun(tx, step, claim);
          // Lock all existing publication windows in stable order, then take a NEW READ COMMITTED snapshot.
          // New windows cannot publish before their own healthy maintenance run under this same physical-target mutex.
          const locked = await step(() =>
            tx
              .select({
                id: sql<string>`w.id::text`,
                matches: sql<boolean>`${windowFence}`,
              })
              .from(sql`${w} w`)
              .orderBy(sql`w.id`)
              .for("update"),
          );
          if (locked.filter((row) => row.matches).length !== 1) fail();
          const [observed] = await step(() =>
            tx
              .select({
                now: sql<number>`pg_catalog.floor(extract(epoch from c.at)*1000)::double precision`,
                closed: sql<boolean>`not exists(select 1 from ${w} other where other.stopped_at is null and other.expires_at>c.at)`,
                expiredPermits: sql<number>`d.expired_permits::double precision`,
                expiredPackets: sql<number>`d.expired_packets::double precision`,
                all: sql<number>`d.all_packets::double precision`,
                latest: sql<
                  number | null
                >`pg_catalog.floor(extract(epoch from d.latest)*1000)::double precision`,
              })
              .from(
                sql`(select pg_catalog.clock_timestamp() at) c cross join ${w} w cross join lateral (select pg_catalog.count(distinct a.permit_id) filter(where a.retain_until<=c.at) expired_permits,pg_catalog.count(*) filter(where a.retain_until<=c.at) expired_packets,pg_catalog.count(*) all_packets,pg_catalog.max(a.retain_until) latest from ${a} a where a.purged_at is null) d`,
              )
              .where(windowFence),
          );
          if (
            !observed ||
            !Number.isSafeInteger(observed.now) ||
            observed.now < 0 ||
            observed.now >= row.leaseExpiresAt!.getTime() ||
            typeof observed.closed !== "boolean" ||
            !Number.isSafeInteger(observed.expiredPermits) ||
            observed.expiredPermits < 0 ||
            !Number.isSafeInteger(observed.expiredPackets) ||
            observed.expiredPackets < observed.expiredPermits ||
            observed.expiredPackets > 2 * observed.expiredPermits ||
            !Number.isSafeInteger(observed.all) ||
            observed.all < observed.expiredPackets ||
            (observed.all === 0
              ? observed.latest !== null
              : !Number.isSafeInteger(observed.latest))
          )
            fail();
          const state: Row["state"] =
            observed.closed && observed.all === 0
              ? "closed"
              : observed.expiredPackets === 0 &&
                  (observed.latest === null ||
                    observed.latest <=
                      target.coverageThroughMs - RESEARCH_PACKET_PURGE_LAG_MS)
                ? "healthy"
                : "pending";
          const [updated] = await step(() =>
            tx
              .update(maintenance)
              .set({
                state,
                observedAt: new Date(observed.now),
                finishedAt: new Date(observed.now),
                expiredPermits: observed.expiredPermits,
                expiredPackets: observed.expiredPackets,
                unpurgedPackets: observed.all,
                latestRetainUntil:
                  observed.latest === null ? null : new Date(observed.latest),
                purgedPermits: counts.permits,
                purgedPackets: counts.packets,
              })
              .where(
                sql`${maintenance.profileSha256}=${target.profileSha256} and ${maintenance.revision}=${bound.revision} and ${maintenance.runId}=${nonce}::uuid and ${maintenance.state}='started'`,
              )
              .returning(),
          );
          const value = ownRow(updated);
          if (
            value.revision !== bound.revision + 1 ||
            value.runId !== nonce ||
            value.state !== state
          )
            fail();
          return projection(value, observed.now);
        });
        claims.delete(claim);
        return result;
      },
      /** Failure is metadata-only; an unknown/expired ACK never replays packet work or restores healthy state. */
      async fail(
        claim: ResearchMaintenanceRun,
        signal: AbortSignal,
        absoluteDeadlineAt?: number,
      ): Promise<void> {
        await root(
          signal,
          async (tx, step) => {
            const { bound, now } = await activeRun(tx, step, claim);
            const [updated] = await step(() =>
              tx
                .update(maintenance)
                .set({
                  state: "failed",
                  finishedAt: new Date(now),
                  observedAt: null,
                  expiredPermits: null,
                  expiredPackets: null,
                  unpurgedPackets: null,
                  latestRetainUntil: null,
                  purgedPermits: null,
                  purgedPackets: null,
                })
                .where(
                  sql`${maintenance.profileSha256}=${target.profileSha256} and ${maintenance.revision}=${bound.revision} and ${maintenance.runId}=${nonce}::uuid and ${maintenance.state}='started'`,
                )
                .returning(),
            );
            const value = ownRow(updated);
            if (
              value.revision !== bound.revision + 1 ||
              value.state !== "failed"
            )
              fail();
          },
          false,
          true,
          absoluteDeadlineAt,
        );
        claims.delete(claim);
      },
      /** Fresh exact metadata lookup supports lost-final-ACK reconciliation; it grants no processing permission and performs no replay. */
      async inspect(signal: AbortSignal): Promise<ResearchMaintenanceState> {
        return root(
          signal,
          async (tx, step) =>
            projection(await current(tx, step), await clock(tx, step)),
          true,
        );
      },
      /** Independent bounded teardown even after caller abort. The outer owner must then close its actual dedicated pool. */
      async release(absoluteDeadlineAt?: number): Promise<void> {
        if (
          absoluteDeadlineAt !== undefined &&
          (typeof absoluteDeadlineAt !== "number" ||
            !Number.isFinite(absoluteDeadlineAt))
        )
          fail();
        if (released) fail();
        released = true;
        teardown.abort();
        const end = Math.min(
          performance.now() + RESEARCH_OPERATION_TIMEOUT_MS,
          absoluteDeadlineAt ?? Infinity,
        );
        try {
          await withinResearchDeadline(
            new AbortController().signal,
            async (bounded) => {
              // Draining the public operation alone is insufficient if a timeout returned before native COMMIT/ROLLBACK ACK.
              await operationDone;
              await Promise.allSettled([...transactions]);
              bounded.throwIfAborted();
              if (performance.now() >= end) fail();
              if (!attempted) return;
              await root(
                bounded,
                async (tx, step) => {
                  const [row] = await step(() =>
                    tx
                      .select({
                        released: sql<boolean>`case when ${held()} then case when pg_catalog.pg_advisory_unlock(${lockKey}::bigint) then pg_catalog.set_config(${guc},'',false)='' else false end else false end`,
                        targetLock: sql<boolean>`exists(select 1 from pg_catalog.pg_locks l where l.locktype='advisory' and l.pid=pg_catalog.pg_backend_pid() and l.granted and l.classid=((${lockKey}::bigint>>32)&4294967295)::oid and l.objid=(${lockKey}::bigint&4294967295)::oid and l.objsubid=1)`,
                      })
                      .from(sql`(select 1) maintenance_release`),
                  );
                  if (
                    !row ||
                    (!row.released &&
                      (acquired || (!lockAcknowledged && row.targetLock)))
                  )
                    fail();
                },
                false,
                false,
                end,
                true,
              );
            },
            end,
          );
        } catch {
          return fail();
        }
      },
    };
    return Object.freeze({
      async begin(signal: AbortSignal) {
        return operate(() => methods.begin(signal));
      },
      async finish(
        claim: ResearchMaintenanceRun,
        removed: { permits: number; packets: number },
        signal: AbortSignal,
      ) {
        return operate(() => methods.finish(claim, removed, signal));
      },
      async fail(
        claim: ResearchMaintenanceRun,
        signal: AbortSignal,
        absoluteDeadlineAt?: number,
      ) {
        return operate(() => methods.fail(claim, signal, absoluteDeadlineAt));
      },
      async inspect(signal: AbortSignal) {
        return operate(() => methods.inspect(signal));
      },
      release: methods.release,
    });
  } catch {
    return fail();
  }
}
