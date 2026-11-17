/** Inactive governed first-window publisher. No env, connection factory, service installation, provider or automatic adoption. */
import "server-only";
import { is, type SQL, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { createUuidV7 } from "../lib/ids";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import { RESEARCH_MAINTENANCE_LOCK_PREFIX } from "./maintenanceTarget";
import {
  inspectResearchManagedPublication,
  inspectResearchPublication,
  type PreparedResearchManagedPublication,
  type PreparedResearchPublication,
  RESEARCH_PUBLICATION_ERROR,
  type ResearchPublicationFacts,
} from "./publication";
import type {
  ResearchAdmissionDatabase,
  ResearchAdmissionTransaction,
} from "./sqlAdmission";
import { researchRelationShareLock } from "./sqlRelationLock";

const fail = (): never => {
  throw Error(RESEARCH_PUBLICATION_ERROR);
};
const table = (ns: string, name: string) =>
  sql`${sql.identifier(ns)}.${sql.identifier(name)}`;
/** Writer-managed policy/window/profile facts only. The requested manifest is not persisted as an original adoption receipt. Neither an insert nor a matching restart authorizes generation or delivery. */
export interface ResearchPublicationReceipt {
  readonly kind: "private_research_publication_receipt";
  /** Requested document identity, not proof that this whole manifest/read envelope was originally persisted or adopted. */
  readonly requested_manifest_sha256: string;
  readonly outcome: "inserted" | "already-matching";
}
/** Fresh descriptive SQL snapshot. It does not repair configuration, establish consent or mint a request/source/read capability. */
export interface ResearchPublicationObservation {
  readonly kind: "private_research_publication_observation";
  /** Requested document identity, not proof that this whole manifest/read envelope was originally persisted or adopted. */
  readonly requested_manifest_sha256: string;
  readonly configuration: "absent" | "matching" | "conflicting";
  readonly policy: "absent" | "published" | "draft" | "revoked" | "changed";
}
/** Independently captured original physical relation identities. Optional for legacy callers; fixed-trial setup supplies all five. Not endpoint provenance or adoption authority. */
export interface ResearchPublicationTableOids {
  readonly policies: number;
  readonly maintenance: number;
  readonly windows: number;
  readonly permits: number;
  readonly artifacts: number;
}
type Step = <T>(work: () => PromiseLike<T>) => Promise<T>;
function context(
  database: ResearchAdmissionDatabase,
  readFacts: () => ResearchPublicationFacts,
  independentlyAdoptedSha256: string,
  inheritedDeadlineAt?: number,
  expectedTableOids?: ResearchPublicationTableOids,
) {
  // Capture before inspecting/copying the private policy so synchronous work consumes the original allowance too.
  const started = performance.now();
  if (
    inheritedDeadlineAt !== undefined &&
    (typeof inheritedDeadlineAt !== "number" ||
      !Number.isFinite(inheritedDeadlineAt))
  )
    fail();
  const end = Math.min(
    started + RESEARCH_OPERATION_TIMEOUT_MS,
    inheritedDeadlineAt ?? Infinity,
  );
  if (
    is(database, PgTransaction) ||
    "rollback" in database ||
    !/^[a-f0-9]{64}$/.test(independentlyAdoptedSha256)
  )
    fail();
  const expected =
    expectedTableOids === undefined
      ? undefined
      : expectedTableOids && typeof expectedTableOids === "object"
        ? [
            expectedTableOids.policies,
            expectedTableOids.maintenance,
            expectedTableOids.windows,
            expectedTableOids.permits,
            expectedTableOids.artifacts,
          ]
        : fail();
  if (
    expectedTableOids !== undefined &&
    JSON.stringify(Object.keys(expectedTableOids).sort()) !==
      JSON.stringify([
        "artifacts",
        "maintenance",
        "permits",
        "policies",
        "windows",
      ])
  )
    fail();
  if (
    expected &&
    (new Set(expected).size !== 5 ||
      !expected.every(
        (n) => Number.isSafeInteger(n) && n > 0 && n <= 4294967295,
      ))
  )
    fail();
  const facts = readFacts();
  if (
    facts.document_sha256 !== independentlyAdoptedSha256 ||
    performance.now() >= end
  )
    fail();
  const { target } = facts,
    s = target.scope,
    ns = target.storage.schemaName;
  const targets = [
    [facts.source_storage.schemaName, "chat_research_source_policies"],
    [target.maintenanceSchema, "chat_research_maintenance"],
    [ns, "chat_research_windows"],
    [ns, "chat_research_permits"],
    [ns, "chat_research_artifacts"],
  ] as const;
  const [p, m, w, r, a] = targets.map(([schema, name]) => table(schema, name));
  const windowMatch = sql`w.id=${s.windowId}::uuid and w.approval_sha256=${s.approvalSha256} and w.actor_id=${s.actorId}::uuid and w.corpus_version=${s.corpusVersion} and w.model=${s.model} and w.processor_profile=${s.processorProfile} and w.begins_at=to_timestamp(${s.beginsAtMs}::double precision/1000) and w.expires_at=to_timestamp(${s.expiresAtMs}::double precision/1000) and w.max_requests=${s.maxRequests} and w.per_request_pico=${s.perRequestPico} and w.total_pico=${s.totalPico}`;
  const maintenanceRows = sql`m.artifact_table_oid=${target.artifactTableOid} or m.artifact_schema=${ns} or m.profile_sha256=${target.profileSha256}`;
  const maintenanceMatch = sql`m.profile_sha256=${target.profileSha256} and m.target_sha256=${target.targetSha256} and m.artifact_schema=${ns} and m.artifact_table_oid=${target.artifactTableOid} and m.publication_cutoff=to_timestamp(${target.publicationCutoffMs}::double precision/1000) and m.coverage_through=to_timestamp(${target.coverageThroughMs}::double precision/1000)`;
  let called = false,
    callbackStarted = false;
  async function snapshot(
    tx: ResearchAdmissionTransaction,
    step: Step,
    guard: () => SQL,
    oids: readonly number[],
  ) {
    const [row] = await step(() =>
      tx
        .select({
          ready: sql<boolean>`${guard()}`,
          origins: sql<boolean>`not exists(select 1 from ${w} where tableoid<>${oids[2]}::oid) and not exists(select 1 from ${r} where tableoid<>${oids[3]}::oid) and not exists(select 1 from ${a} where tableoid<>${oids[4]}::oid) and not exists(select 1 from ${m} m where (${maintenanceRows}) and tableoid<>${oids[1]}::oid) and not exists(select 1 from ${p} where corpus_version=${s.corpusVersion} and tableoid<>${oids[0]}::oid)`,
          windows: sql<number>`(select count(*)::double precision from ${w})`,
          permits: sql<number>`(select count(*)::double precision from ${r})`,
          artifacts: sql<number>`(select count(*)::double precision from ${a})`,
          profiles: sql<number>`(select count(*)::double precision from ${m} m where ${maintenanceRows})`,
          windowMatches: sql<boolean>`exists(select 1 from ${w} w where ${windowMatch} and w.tableoid=${oids[2]}::oid)`,
          profileMatches: sql<boolean>`exists(select 1 from ${m} m where ${maintenanceMatch} and m.tableoid=${oids[1]}::oid)`,
          policyState: sql<
            string | null
          >`(select state from ${p} where corpus_version=${s.corpusVersion})`,
          policyMatches: sql<boolean>`exists(select 1 from ${p} where corpus_version=${s.corpusVersion} and policy_json=${facts.source_policy_json} and policy_sha256=${facts.source_policy_sha256} and tableoid=${oids[0]}::oid)`,
          now: sql<number>`pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::double precision`,
        })
        .from(sql`(select 1) publication_snapshot`),
    );
    if (
      !row ||
      row.ready !== true ||
      row.origins !== true ||
      ![row.windows, row.permits, row.artifacts, row.profiles, row.now].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      ![null, "draft", "published", "revoked"].includes(row.policyState)
    )
      fail();
    return row;
  }
  async function run<T>(
    signal: AbortSignal,
    readOnly: boolean,
    work: (
      tx: ResearchAdmissionTransaction,
      step: Step,
      guard: () => SQL,
      oids: readonly number[],
    ) => Promise<T>,
  ): Promise<T> {
    if (called) fail();
    called = true;
    try {
      return await withinResearchDeadline(
        signal,
        async (bounded) => {
          const assert = () => {
            bounded.throwIfAborted();
            if (performance.now() >= end) fail();
          };
          const step: Step = async (work) => {
            assert();
            const value = await work();
            assert();
            return value;
          };
          const result = await database.transaction(
            async (tx) => {
              // A custom runner may not replay a callback after an uncertain COMMIT.
              if (callbackStarted) fail();
              callbackStarted = true;
              await step(() => tx.execute(sql`set local lock_timeout='5s'`));
              await step(() =>
                tx.execute(sql`set local statement_timeout='8s'`),
              );
              await step(() =>
                tx.execute(sql`set local search_path=pg_catalog,pg_temp`),
              );
              const [mode] = await step(() =>
                tx
                  .select({
                    pid: sql<number>`pg_catalog.pg_backend_pid()`,
                    isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
                    readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
                  })
                  .from(sql`(select 1) publication_mode`),
              );
              if (
                !mode ||
                !Number.isSafeInteger(mode.pid) ||
                mode.pid < 1 ||
                mode.isolation !== "read committed" ||
                mode.readOnly !== (readOnly ? "on" : "off")
              )
                fail();
              await step(() =>
                tx.execute(
                  researchRelationShareLock([
                    [p, "corpus_version"],
                    [m, "profile_sha256"],
                    [w, "id"],
                    [r, "id"],
                    [a, "permit_id"],
                  ]),
                ),
              );
              const oids: number[] = [];
              for (const [schema, name] of targets) {
                const rows = await step(() =>
                  tx
                    .select({ oid: sql<number>`c.oid::bigint`.mapWith(Number) })
                    .from(
                      sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
                    )
                    .where(
                      sql`n.nspname=${schema} and c.relname=${name} and c.relkind='r' and c.relpersistence='p'`,
                    ),
                );
                if (
                  rows.length !== 1 ||
                  !Number.isSafeInteger(rows[0].oid) ||
                  rows[0].oid < 1
                )
                  fail();
                oids.push(rows[0].oid);
              }
              if (
                oids[4] !== target.artifactTableOid ||
                (expected &&
                  oids.some((value, index) => value !== expected[index]))
              )
                fail();
              const mappings = () =>
                sql.join(
                  targets.map(
                    ([schema, name], index) =>
                      sql`exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname=${schema} and c.relname=${name} and c.oid=${oids[index]}::oid and c.relkind='r' and c.relpersistence='p')`,
                  ),
                  sql` and `,
                );
              let held: SQL = sql`true`;
              if (!readOnly) {
                const [key] = await step(() =>
                  tx
                    .select({
                      value: sql<string>`pg_catalog.hashtextextended(${RESEARCH_MAINTENANCE_LOCK_PREFIX}||${target.artifactTableOid}::oid::text,0)::text`,
                    })
                    .from(sql`(select 1) publication_key`),
                );
                if (
                  !key ||
                  !/^-?[0-9]{1,20}$/.test(key.value) ||
                  BigInt(key.value) < BigInt("-9223372036854775808") ||
                  BigInt(key.value) >= BigInt("9223372036854775808")
                )
                  fail();
                const ownLock = sql`exists(select 1 from pg_catalog.pg_locks l where l.locktype='advisory' and l.pid=pg_catalog.pg_backend_pid() and l.granted and l.classid=((${key.value}::bigint>>32)&4294967295)::oid and l.objid=(${key.value}::bigint&4294967295)::oid and l.objsubid=1)`;
                const [self] = await step(() =>
                  tx
                    .select({ held: sql<boolean>`${ownLock}` })
                    .from(sql`(select 1) publication_preheld`),
                );
                if (!self || self.held !== false) fail();
                const [lock] = await step(() =>
                  tx
                    .select({
                      acquired: sql<boolean>`pg_catalog.pg_try_advisory_xact_lock(${key.value}::bigint)`,
                    })
                    .from(sql`(select 1) publication_lock`),
                );
                if (lock?.acquired !== true) fail();
                const nonce = createUuidV7(),
                  guc = "magickli_publication.tx_nonce";
                await step(() =>
                  tx.execute(
                    sql`select pg_catalog.set_config(${guc},${nonce},true)`,
                  ),
                );
                held = sql`pg_catalog.pg_backend_pid()=${mode.pid} and pg_catalog.current_setting(${guc},true)=${nonce} and ${ownLock}`;
              }
              const guard = () => sql`${mappings()} and ${held}`;
              const output = await work(tx, step, guard, oids);
              const [final] = await step(() =>
                tx
                  .select({ ready: sql<boolean>`${guard()}` })
                  .from(sql`(select 1) publication_final_guard`),
              );
              if (final?.ready !== true) fail();
              assert();
              return output;
            },
            {
              isolationLevel: "read committed",
              accessMode: readOnly ? "read only" : "read write",
            },
          );
          assert();
          return result;
        },
        end,
      );
    } catch {
      return fail();
    }
  }
  return { facts, target, s, p, m, w, snapshot, run };
}
/**
 * Trusted startup only: supply an independently adopted exact manifest and a supported dedicated Drizzle root,
 * never an outer transaction or callback-retrying adapter. Create immediately before publish (one original8s budget). An inherited monotonic deadline can only shorten it.
 * It INSTALLS source grants/window/idle maintenance, but cannot establish consent. Every failure may hide a COMMIT:
 * close/drain the actual writer pool/backend before a fresh-root read-only observation; never automatically replay.
 */
export function createSqlResearchPublisher(
  database: ResearchAdmissionDatabase,
  prepared: PreparedResearchPublication,
  independentlyAdoptedSha256: string,
  inheritedDeadlineAt?: number,
  expectedTableOids?: ResearchPublicationTableOids,
) {
  const c = context(
    database,
    () => inspectResearchPublication(prepared),
    independentlyAdoptedSha256,
    inheritedDeadlineAt,
    expectedTableOids,
  );
  return publisher(c);
}
/** Explicit managed publication entry. Same native target/mutex/deadline/one-shot checks; no local handle conversion or automatic adoption. */
export function createSqlResearchManagedPublisher(
  database: ResearchAdmissionDatabase,
  prepared: PreparedResearchManagedPublication,
  independentlyAdoptedSha256: string,
  inheritedDeadlineAt?: number,
  expectedTableOids?: ResearchPublicationTableOids,
) {
  return publisher(
    context(
      database,
      () => inspectResearchManagedPublication(prepared),
      independentlyAdoptedSha256,
      inheritedDeadlineAt,
      expectedTableOids,
    ),
  );
}
function publisher(c: ReturnType<typeof context>) {
  return Object.freeze({
    async publish(signal: AbortSignal): Promise<ResearchPublicationReceipt> {
      return c.run(signal, false, async (tx, step, guard, oids) => {
        const policies = await step(() =>
          tx
            .select({
              state: sql<string>`state`,
              oid: sql<number>`tableoid::bigint`.mapWith(Number),
              ready: sql<boolean>`${guard()}`,
              matches: sql<boolean>`policy_json=${c.facts.source_policy_json} and policy_sha256=${c.facts.source_policy_sha256}`,
            })
            .from(c.p)
            .where(sql`corpus_version=${c.s.corpusVersion}`)
            .for("share"),
        );
        if (
          policies.length > 1 ||
          (policies[0] &&
            (policies[0].oid !== oids[0] ||
              policies[0].ready !== true ||
              policies[0].state !== "published" ||
              policies[0].matches !== true))
        )
          fail();
        // A new statement AFTER the mutex and policy row lock observes the current namespace contents.
        const before = await c.snapshot(tx, step, guard, oids);
        if (
          before.windows === 1 &&
          before.profiles === 1 &&
          before.windowMatches &&
          before.profileMatches &&
          before.policyState === "published" &&
          before.policyMatches
        ) {
          return Object.freeze({
            kind: "private_research_publication_receipt",
            requested_manifest_sha256: c.facts.document_sha256,
            outcome: "already-matching",
          });
        }
        if (
          before.windows !== 0 ||
          before.permits !== 0 ||
          before.artifacts !== 0 ||
          before.profiles !== 0 ||
          before.now < c.s.beginsAtMs ||
          before.now >= c.s.expiresAtMs
        )
          fail();
        async function insert(statement: SQL, oid: number) {
          const result = await step(() => tx.execute(statement));
          // Supported postgres-js/Neon/PGlite roots expose rows as an array or QueryResult.rows.
          const rows = Array.isArray(result)
            ? result
            : (result as { rows?: unknown }).rows;
          if (
            !Array.isArray(rows) ||
            rows.length !== 1 ||
            !rows[0] ||
            Number(rows[0].oid) !== oid
          )
            fail();
        }
        if (!policies.length)
          await insert(
            sql`insert into ${c.p} (corpus_version,policy_json,policy_sha256,state) select ${c.s.corpusVersion},${c.facts.source_policy_json},${c.facts.source_policy_sha256},'published' where ${guard()} returning tableoid::bigint as oid`,
            oids[0],
          );
        await insert(
          sql`insert into ${c.w} (id,approval_sha256,actor_id,corpus_version,model,processor_profile,begins_at,expires_at,max_requests,per_request_pico,total_pico) select ${c.s.windowId}::uuid,${c.s.approvalSha256},${c.s.actorId}::uuid,${c.s.corpusVersion},${c.s.model},${c.s.processorProfile},to_timestamp(${c.s.beginsAtMs}::double precision/1000),to_timestamp(${c.s.expiresAtMs}::double precision/1000),${c.s.maxRequests},${c.s.perRequestPico},${c.s.totalPico} where ${guard()} returning tableoid::bigint as oid`,
          oids[2],
        );
        await insert(
          sql`insert into ${c.m} (profile_sha256,target_sha256,artifact_schema,artifact_table_oid,publication_cutoff,coverage_through) select ${c.target.profileSha256},${c.target.targetSha256},${c.target.storage.schemaName},${c.target.artifactTableOid},to_timestamp(${c.target.publicationCutoffMs}::double precision/1000),to_timestamp(${c.target.coverageThroughMs}::double precision/1000) where ${guard()} returning tableoid::bigint as oid`,
          oids[1],
        );
        const after = await c.snapshot(tx, step, guard, oids);
        if (
          after.windows !== 1 ||
          after.profiles !== 1 ||
          !after.windowMatches ||
          !after.profileMatches ||
          after.policyState !== "published" ||
          !after.policyMatches ||
          after.now < c.s.beginsAtMs ||
          after.now >= c.s.expiresAtMs
        )
          fail();
        return Object.freeze({
          kind: "private_research_publication_receipt",
          requested_manifest_sha256: c.facts.document_sha256,
          outcome: "inserted",
        });
      });
    },
  });
}
/** Fresh supported root AFTER actual uncertain-writer closure. Descriptive only; no advisory acquisition, publication, repair or generation/read authority. */
export async function observeSqlResearchPublication(
  database: ResearchAdmissionDatabase,
  prepared: PreparedResearchPublication,
  independentlyAdoptedSha256: string,
  signal: AbortSignal,
  inheritedDeadlineAt?: number,
  expectedTableOids?: ResearchPublicationTableOids,
): Promise<ResearchPublicationObservation> {
  const c = context(
    database,
    () => inspectResearchPublication(prepared),
    independentlyAdoptedSha256,
    inheritedDeadlineAt,
    expectedTableOids,
  );
  return observe(c, signal);
}
/** Fresh descriptive observation for the managed format after actual writer settlement. Does not adopt or repair it. */
export async function observeSqlResearchManagedPublication(
  database: ResearchAdmissionDatabase,
  prepared: PreparedResearchManagedPublication,
  independentlyAdoptedSha256: string,
  signal: AbortSignal,
  inheritedDeadlineAt?: number,
  expectedTableOids?: ResearchPublicationTableOids,
): Promise<ResearchPublicationObservation> {
  return observe(
    context(
      database,
      () => inspectResearchManagedPublication(prepared),
      independentlyAdoptedSha256,
      inheritedDeadlineAt,
      expectedTableOids,
    ),
    signal,
  );
}
async function observe(
  c: ReturnType<typeof context>,
  signal: AbortSignal,
): Promise<ResearchPublicationObservation> {
  return c.run(signal, true, async (tx, step, guard, oids) => {
    const r = await c.snapshot(tx, step, guard, oids);
    const configuration =
      r.windows === 1 && r.profiles === 1 && r.windowMatches && r.profileMatches
        ? "matching"
        : r.windows === 0 &&
            r.profiles === 0 &&
            r.permits === 0 &&
            r.artifacts === 0
          ? "absent"
          : "conflicting";
    const policy =
      r.policyState === null
        ? "absent"
        : !r.policyMatches
          ? "changed"
          : (r.policyState as "published" | "draft" | "revoked");
    return Object.freeze({
      kind: "private_research_publication_observation",
      requested_manifest_sha256: c.facts.document_sha256,
      configuration,
      policy,
    });
  });
}
