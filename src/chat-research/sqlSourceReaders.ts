/** Inactive uncached SQL/auth readers. No runtime singleton, provider, publication writer or route. */
import "server-only";
import { createHash } from "node:crypto";
import { is, sql } from "drizzle-orm";
import {
  type PgDatabase,
  type PgQueryResultHKT,
  PgTransaction,
  type PgTransactionConfig,
} from "drizzle-orm/pg-core";
import * as v from "valibot";
import {
  createSqlAuth,
  getFreshSqlSession,
  type SqlAuthOptions,
} from "../auth/sqlAuth";
import {
  parseResearchAccountingTarget,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
} from "./accountingScope";
import {
  prepareResearchMaintenanceTarget,
  RESEARCH_MAINTENANCE_STALE_MS,
  type ResearchMaintenanceTargetInput,
} from "./maintenanceTarget";
import {
  RESEARCH_SOURCE_ERROR,
  type ResearchSourceContext,
  type ResearchSourceReaders,
  type ResearchSourceSubject,
} from "./sourceAuthorization";
import {
  readResearchSourcePolicy,
  researchPolicySnapshot,
} from "./sourcePolicy";

type Transaction = Pick<PgDatabase<PgQueryResultHKT>, "select" | "execute">;
/** Confirmed root transactions only. Supply full auth-compatible Drizzle transactions;
 * custom runners must not wrap an outer snapshot or retry callbacks. */
export interface ResearchSourceDatabase {
  readonly rollback?: never;
  transaction<T>(
    work: (tx: Transaction) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T>;
}
/** Trusted deployment scope. Neither namespace nor corpus identity comes from a request as authority. */
export interface ResearchSourceStorage {
  readonly corpusVersion: string;
  /** Policy table namespace. Auth defaults here for backward compatibility. */
  readonly schemaName?: string;
  /** Actual app identity namespace; trusted startup only, never chosen by a client. */
  readonly authSchemaName?: string;
}
/** Existing trusted window binding, not an adoption or a window writer. Full immutable scope must match at the final source/session SQL decision. */
export interface ResearchSourceWindow {
  readonly scope: ResearchAccountingScope;
  readonly storage?: ResearchAccountingStorage;
}
/** Factory settings only, copied from app-owned auth configuration. Never use a root auth DB outside READ ONLY. */
export type ResearchSourceAuthOptions = Readonly<Omit<SqlAuthOptions, "db">>;
/** Copy only immutable auth settings; never clone/capture an incidental DB root, callback or provider state. Does not authenticate or read environment. */
export function copyResearchSourceAuthOptions(
  options: ResearchSourceAuthOptions,
): ResearchSourceAuthOptions {
  return Object.freeze({
    baseURL: options.baseURL,
    secret: options.secret,
    googleClientId: options.googleClientId,
    googleClientSecret: options.googleClientSecret,
    localTestLoginEnabled: options.localTestLoginEnabled,
  });
}
const namespaceShape = v.pipe(
  v.string(),
  v.maxLength(63),
  v.regex(/^[a-z_][a-z0-9_]*$/),
  v.check(
    (s) => s.trim() === s && !s.startsWith("pg_") && s !== "information_schema",
  ),
);
const scopeShape = v.strictObject({
  corpusVersion: v.pipe(v.string(), v.length(64), v.regex(/^[0-9a-f]{64}$/)),
  schemaName: v.optional(namespaceShape, "public"),
  authSchemaName: v.optional(namespaceShape),
});
/** Owned normalized startup scope only; parsing proves no identity, source permission or read adoption. */
export function parseResearchSourceStorage(value: ResearchSourceStorage) {
  try {
    const parsed = v.parse(scopeShape, value);
    return Object.freeze({
      ...parsed,
      authSchemaName: parsed.authSchemaName ?? parsed.schemaName,
    });
  } catch {
    throw Error(RESEARCH_SOURCE_ERROR);
  }
}
const same = (a: ResearchSourceSubject, b: ResearchSourceSubject) =>
  a.kind === "user" &&
  b.kind === "user" &&
  a.user_id === b.user_id &&
  a.session_id === b.session_id;
function fail(): never {
  throw Error(RESEARCH_SOURCE_ERROR);
}
const clock = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail();
  return value;
};
const bindingHash = (subject: ResearchSourceSubject, token: string) =>
  createHash("sha256")
    .update(
      JSON.stringify([
        "magickli-private-research-session-v1",
        subject.user_id,
        subject.session_id,
        token,
      ]),
    )
    .digest("hex");
interface Binding {
  readonly subject: ResearchSourceSubject;
  readonly token: string;
  readonly digest: string;
}
interface SessionRow {
  subject: ResearchSourceSubject;
  expires_at_ms: number;
  db_now_ms: number;
}
interface PolicyRow {
  policyJson: string;
  policySha256: string;
  revision: string;
}
type Phase =
  | "new"
  | "authenticating"
  | "authenticated"
  | "loading"
  | "loaded"
  | "fencing"
  | "done"
  | "failed";
/**
 * One factory per authorization gate. Verify the signed cookie using the actual
 * app factory inside DB-enforced READ ONLY, then atomically fence the exact
 * authenticated token + owner + current policy + DB time. No token is returned.
 * Caller must use this with requireResearchSourceAccess, never treat a snapshot
 * or authenticated identity alone as permission. Publishing a new corpus row
 * does not revoke an older published corpus; replacement needs explicit policy.
 */
export function createSqlResearchSourceReaders(
  database: ResearchSourceDatabase,
  authOptions: ResearchSourceAuthOptions,
  requestHeaders: Headers,
  value: ResearchSourceStorage,
): ResearchSourceReaders {
  return sqlSourceReaders(database, authOptions, requestHeaders, value);
}
/** Require a current exact accounting window in the SAME final SQL snapshot as session/token/owner/source policy. This read-only helper does not adopt a manifest, create a window or authorize a provider. */
export function createSqlResearchWindowSourceReaders(
  database: ResearchSourceDatabase,
  authOptions: ResearchSourceAuthOptions,
  requestHeaders: Headers,
  value: ResearchSourceStorage,
  window: ResearchSourceWindow,
): ResearchSourceReaders {
  try {
    const config = v.parse(
      v.strictObject({ scope: v.unknown(), storage: v.optional(v.unknown()) }),
      window,
    );
    const target = parseResearchAccountingTarget(
      config.scope as ResearchAccountingScope,
      config.storage as ResearchAccountingStorage | undefined,
    );
    return sqlSourceReaders(
      database,
      authOptions,
      requestHeaders,
      value,
      target,
    );
  } catch {
    return fail();
  }
}
/** Trusted generation-only maintenance binding. Does not seed/adopt a profile or authorize a provider. */
export function createSqlResearchMaintenanceSourceReaders(
  database: ResearchSourceDatabase,
  authOptions: ResearchSourceAuthOptions,
  requestHeaders: Headers,
  value: ResearchSourceStorage,
  window: ResearchSourceWindow,
  maintenanceInput: ResearchMaintenanceTargetInput,
): ResearchSourceReaders {
  try {
    const config = v.parse(
        v.strictObject({
          scope: v.unknown(),
          storage: v.optional(v.unknown()),
        }),
        window,
      ),
      target = parseResearchAccountingTarget(
        config.scope as ResearchAccountingScope,
        config.storage as ResearchAccountingStorage | undefined,
      ),
      maintenance = prepareResearchMaintenanceTarget(maintenanceInput);
    if (
      JSON.stringify([target.scope, target.storage]) !==
      JSON.stringify([maintenance.scope, maintenance.storage])
    )
      fail();
    return sqlSourceReaders(
      database,
      authOptions,
      requestHeaders,
      value,
      target,
      maintenance,
    );
  } catch {
    return fail();
  }
}
function sqlSourceReaders(
  database: ResearchSourceDatabase,
  authOptions: ResearchSourceAuthOptions,
  requestHeaders: Headers,
  value: ResearchSourceStorage,
  window?: ReturnType<typeof parseResearchAccountingTarget>,
  maintenance?: ReturnType<typeof prepareResearchMaintenanceTarget>,
): ResearchSourceReaders {
  try {
    if (is(database, PgTransaction) || "rollback" in database) fail();
    const scope = parseResearchSourceStorage(value),
      headers = new Headers(requestHeaders);
    if (window && window.scope.corpusVersion !== scope.corpusVersion) fail();
    const settings = copyResearchSourceAuthOptions(authOptions);
    const table = (namespace: string, name: string) =>
      sql`${sql.identifier(namespace)}.${sql.identifier(name)}`;
    const sessions = table(scope.authSchemaName, "auth_session"),
      users = table(scope.authSchemaName, "auth_user"),
      policies = table(scope.schemaName, "chat_research_source_policies"),
      windows = window
        ? table(window.storage.schemaName, "chat_research_windows")
        : undefined,
      maintenanceTable = maintenance
        ? table(maintenance.maintenanceSchema, "chat_research_maintenance")
        : undefined,
      artifactTable = maintenance
        ? table(maintenance.storage.schemaName, "chat_research_artifacts")
        : undefined;
    let phase: Phase = "new",
      operationSignal: AbortSignal | undefined,
      authenticated: Binding | undefined,
      loaded: PolicyRow | undefined,
      databaseNow: number | undefined;
    function invalidate() {
      phase = "failed";
      authenticated = undefined;
      loaded = undefined;
      databaseNow = undefined;
      operationSignal?.removeEventListener("abort", invalidate);
    }
    async function consume<T, R>(
      expected: Phase,
      pending: Phase,
      complete: Phase,
      signal: AbortSignal,
      work: () => Promise<T>,
      commit: (value: T) => R,
    ): Promise<R> {
      try {
        if (
          phase !== expected ||
          (operationSignal && operationSignal !== signal)
        )
          fail();
        signal.throwIfAborted();
        if (!operationSignal) {
          operationSignal = signal;
          signal.addEventListener("abort", invalidate, { once: true });
        }
        phase = pending;
        const result = await work();
        if (phase !== pending || operationSignal !== signal) fail();
        signal.throwIfAborted();
        const output = commit(result);
        phase = complete;
        if (complete === "done")
          operationSignal.removeEventListener("abort", invalidate);
        return output;
      } catch {
        invalidate();
        return fail();
      }
    }
    async function root<T>(
      signal: AbortSignal,
      work: (
        tx: Transaction,
        step: <R>(action: () => PromiseLike<R>) => Promise<R>,
      ) => Promise<T>,
    ): Promise<T> {
      signal.throwIfAborted();
      const step = async <R>(action: () => PromiseLike<R>) => {
        signal.throwIfAborted();
        const result = await action();
        signal.throwIfAborted();
        return result;
      };
      const result = await database.transaction(
        async (tx) => {
          await step(() => tx.execute(sql`set local lock_timeout='5s'`));
          await step(() => tx.execute(sql`set local statement_timeout='8s'`));
          await step(() =>
            tx.execute(
              // Better Auth's generated table names are unqualified. Resolve them only in
              // the configured identity namespace; policy SQL stays explicitly qualified.
              sql`set local search_path=pg_catalog,${sql.identifier(scope.authSchemaName)},pg_temp`,
            ),
          );
          const [transactionMode] = await step(() =>
            tx
              .select({
                isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
                readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
              })
              .from(sql`(select 1) guard`),
          );
          if (
            transactionMode?.isolation !== "read committed" ||
            transactionMode.readOnly !== "on"
          )
            fail();
          await step(() =>
            tx.execute(
              sql`lock table ${sessions},${users},${policies}${windows ? sql`,${windows}` : sql``}${maintenanceTable ? sql`,${maintenanceTable},${artifactTable}` : sql``} in access share mode`,
            ),
          );
          const durable = await step(() =>
            tx
              .select({
                name: sql<string>`c.relname`,
                namespace: sql<string>`n.nspname`,
                oid: sql<string>`c.oid::text`,
              })
              .from(
                sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
              )
              .where(
                sql`(((n.nspname=${scope.authSchemaName} and c.relname in ('auth_session','auth_user')) or (n.nspname=${scope.schemaName} and c.relname='chat_research_source_policies')) ${window ? sql` or (n.nspname=${window.storage.schemaName} and c.relname='chat_research_windows')` : sql``}${maintenance ? sql` or (n.nspname=${maintenance.maintenanceSchema} and c.relname='chat_research_maintenance') or (n.nspname=${maintenance.storage.schemaName} and c.relname='chat_research_artifacts')` : sql``}) and c.relkind='r' and c.relpersistence='p'`,
              ),
          );
          if (durable.length !== (maintenance ? 6 : window ? 4 : 3)) fail();
          if (
            maintenance &&
            !durable.some(
              (r) =>
                r.name === "chat_research_artifacts" &&
                r.namespace === maintenance.storage.schemaName &&
                r.oid === String(maintenance.artifactTableOid),
            )
          )
            fail();
          return work(tx, step);
        },
        { isolationLevel: "read committed", accessMode: "read only" },
      );
      signal.throwIfAborted();
      return result;
    }
    const currentSession = (binding: Binding) =>
      sql`s.id=${binding.subject.session_id}::uuid and u.id=${binding.subject.user_id}::uuid and s.token=${binding.token} and s.expires_at>clock.at`;
    const mode = sql`pg_catalog.current_setting('transaction_isolation')='read committed' and pg_catalog.current_setting('transaction_read_only')='on'`;
    const principalFields = sql`'subject',jsonb_build_object('kind','user','user_id',u.id::text,'session_id',s.id::text),'expires_at_ms',floor(extract(epoch from s.expires_at)*1000)::bigint`;
    const staleInterval = sql`(${RESEARCH_MAINTENANCE_STALE_MS}::double precision * interval '1 millisecond')`;
    const finalPrincipalFields = maintenance
      ? sql`'subject',jsonb_build_object('kind','user','user_id',u.id::text,'session_id',s.id::text),'expires_at_ms',floor(extract(epoch from least(s.expires_at,w.expires_at,m.observed_at+${staleInterval}))*1000)::bigint`
      : window
        ? sql`'subject',jsonb_build_object('kind','user','user_id',u.id::text,'session_id',s.id::text),'expires_at_ms',floor(extract(epoch from least(s.expires_at,w.expires_at))*1000)::bigint`
        : principalFields;
    const w = window?.scope;
    const windowFence = w
      ? sql`w.id=${w.windowId}::uuid and w.approval_sha256=${w.approvalSha256} and w.actor_id=${w.actorId}::uuid and w.actor_id=u.id and w.corpus_version=${w.corpusVersion} and w.corpus_version=p.corpus_version and w.model=${w.model} and w.processor_profile=${w.processorProfile} and w.begins_at=to_timestamp(${w.beginsAtMs}::double precision/1000) and w.expires_at=to_timestamp(${w.expiresAtMs}::double precision/1000) and w.max_requests=${w.maxRequests} and w.per_request_pico=${w.perRequestPico} and w.total_pico=${w.totalPico} and w.stopped_at is null and w.begins_at<=clock.at and w.expires_at>clock.at`
      : sql`true`;
    const maintenanceFence = maintenance
      ? sql`m.profile_sha256=${maintenance.profileSha256} and m.target_sha256=${maintenance.targetSha256} and m.artifact_schema=${maintenance.storage.schemaName} and m.artifact_table_oid=${maintenance.artifactTableOid}::bigint and m.publication_cutoff=pg_catalog.to_timestamp(${maintenance.publicationCutoffMs}::double precision/1000) and m.coverage_through=pg_catalog.to_timestamp(${maintenance.coverageThroughMs}::double precision/1000) and m.state='healthy' and m.expired_packets=0 and m.expired_permits=0 and m.observed_at<=clock.at and m.observed_at>clock.at-${staleInterval} and exists(select 1 from pg_catalog.pg_class mc join pg_catalog.pg_namespace mn on mn.oid=mc.relnamespace where mn.nspname=${maintenance.storage.schemaName} and mc.relname='chat_research_artifacts' and mc.oid=${maintenance.artifactTableOid}::oid and mc.relkind='r' and mc.relpersistence='p')`
      : sql`true`;
    const dbClock = sql`(select pg_catalog.clock_timestamp() as at) clock`;
    return Object.freeze({
      now: () => {
        if (phase === "failed" || databaseNow === undefined) fail();
        return databaseNow;
      },
      readPrincipal: (signal: AbortSignal) =>
        consume(
          "new",
          "authenticating",
          "authenticated",
          signal,
          () =>
            root(signal, async (tx, step) => {
              const session = await step(() =>
                getFreshSqlSession(
                  createSqlAuth({ ...settings, db: tx }),
                  new Headers(headers),
                ),
              );
              if (
                !session ||
                typeof session.session.token !== "string" ||
                session.session.token.length < 1 ||
                session.session.token.length > 4096
              )
                fail();
              const subject: ResearchSourceSubject = {
                kind: "user",
                user_id: session.user.id,
                session_id: session.session.id,
              };
              const binding: Binding = Object.freeze({
                subject: Object.freeze(subject),
                token: session.session.token,
                digest: bindingHash(subject, session.session.token),
              });
              const rows = await step(() =>
                tx
                  .select({
                    value: sql<SessionRow>`jsonb_build_object(${principalFields},'db_now_ms',floor(extract(epoch from clock.at)*1000)::bigint)`,
                  })
                  .from(
                    sql`${dbClock} cross join ${sessions} s join ${users} u on u.id=s.user_id`,
                  )
                  .where(sql`${mode} and ${currentSession(binding)}`),
              );
              if (rows.length !== 1) fail();
              return { binding, row: rows[0].value };
            }),
          ({ binding, row }) => {
            authenticated = binding;
            databaseNow = clock(row.db_now_ms);
            return {
              subject: structuredClone(binding.subject),
              session_binding_sha256: binding.digest,
              expires_at_ms: clock(row.expires_at_ms),
            };
          },
        ),
      loadSnapshot: (
        subject: ResearchSourceSubject,
        context: ResearchSourceContext,
        signal: AbortSignal,
      ) =>
        consume(
          "authenticated",
          "loading",
          "loaded",
          signal,
          async () => {
            const binding = authenticated;
            if (
              !binding ||
              !same(binding.subject, subject) ||
              context.corpus_version !== scope.corpusVersion ||
              !same(context.subject, subject)
            )
              fail();
            const owned = structuredClone(context);
            const policy = await root(signal, async (tx, step) => {
              const rows = await step(() =>
                tx
                  .select({
                    policyJson: sql<string>`p.policy_json`,
                    policySha256: sql<string>`p.policy_sha256`,
                    revision: sql<string>`p.revision::text`,
                  })
                  .from(sql`${policies} p`)
                  .where(
                    sql`${mode} and p.corpus_version=${scope.corpusVersion} and p.state='published'`,
                  ),
              );
              if (rows.length !== 1) fail();
              return rows[0];
            });
            const document = readResearchSourcePolicy(
              policy.policyJson,
              policy.policySha256,
              scope.corpusVersion,
            );
            const snapshot = researchPolicySnapshot(
              document,
              binding.subject,
              owned,
              policy.revision,
            );
            return { policy, snapshot };
          },
          ({ policy, snapshot }) => {
            loaded = Object.freeze({ ...policy });
            return snapshot;
          },
        ),
      readFence: (
        subject: ResearchSourceSubject,
        corpusVersion: string,
        signal: AbortSignal,
      ) =>
        consume(
          "loaded",
          "fencing",
          "done",
          signal,
          () => {
            const binding = authenticated,
              policy = loaded;
            if (
              !binding ||
              !policy ||
              !same(binding.subject, subject) ||
              corpusVersion !== scope.corpusVersion
            )
              fail();
            return root(signal, async (tx, step) => {
              const rows = await step(() =>
                tx
                  .select({
                    value: sql<{
                      principal: Omit<SessionRow, "db_now_ms"> & {
                        session_binding_sha256: string;
                      };
                      authorization_version: string;
                      db_now_ms: number;
                    }>`jsonb_build_object('principal',jsonb_build_object(${finalPrincipalFields},'session_binding_sha256',${binding.digest}::text),'authorization_version',p.revision::text,'db_now_ms',floor(extract(epoch from clock.at)*1000)::bigint)`,
                  })
                  .from(
                    sql`${dbClock} cross join ${sessions} s join ${users} u on u.id=s.user_id cross join ${policies} p ${windows ? sql`cross join ${windows} w` : sql``}${maintenanceTable ? sql` cross join ${maintenanceTable} m` : sql``}`,
                  )
                  .where(
                    sql`${mode} and ${currentSession(binding)} and ${windowFence} and ${maintenanceFence} and p.corpus_version=${scope.corpusVersion} and p.state='published' and p.revision=${policy.revision}::bigint and p.policy_sha256=${policy.policySha256} and pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.policy_json,'UTF8')),'hex')=${policy.policySha256}`,
                  ),
              );
              if (rows.length !== 1) fail();
              return rows[0].value;
            });
          },
          (row) => {
            databaseNow = clock(row.db_now_ms);
            authenticated = undefined;
            loaded = undefined;
            return {
              principal: row.principal,
              authorization_version: row.authorization_version,
            };
          },
        ),
    });
  } catch {
    return fail();
  }
}
