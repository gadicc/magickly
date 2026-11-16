/** Inactive request-owned managed composition. No env, route, credentials, cache, grants or provider calls on import/construction. */
import "server-only";
import { is, sql } from "drizzle-orm";
import { PgTransaction, type PgTransactionConfig } from "drizzle-orm/pg-core";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import { parseBoundedResearchJson } from "./boundedJson";
import { withinResearchDeadline } from "./boundedWork";
import type { ResearchConfiguredServiceDocument } from "./configuredService";
import { cancelBody, failure, jsonContentType } from "./httpIngress";
import {
  assertResearchManagedNativeRole,
  prepareResearchManagedNativeRole,
  type ResearchManagedNativeRole,
  researchManagedNativeRoleProjection,
} from "./managedNativeRole";
import {
  createResearchManagedOperatorStartup,
  prepareResearchManagedOperatorStartup,
  RESEARCH_MANAGED_STARTUP_BYTE_LIMIT,
  type ResearchManagedOperatorStartupInput,
  type ResearchManagedOperatorStartupOptions,
} from "./managedOperatorStartup";
import {
  RESEARCH_API_PATH,
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
  RESEARCH_READ_BODY_BYTE_LIMIT,
} from "./paths";
import { readPrivateResearchManagedOperatorPrincipal } from "./previewSession";
import {
  inspectResearchManagedPublication,
  prepareResearchManagedPublication,
} from "./publication";
import { loadResearchRemoteCorpus } from "./remoteCorpus";
import { RESEARCH_HTTP_BODY_BYTE_LIMIT } from "./request";
import { parseResearchSourceContext } from "./sourceAuthorization";
import { createSqlResearchCorpusBundleStore } from "./sqlCorpusBundle";
import { createSqlResearchCorpusMetadataStore } from "./sqlCorpusMetadata";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchMaintenanceSourceReaders,
  createSqlResearchSourceReaders,
  type ResearchSourceDatabase,
} from "./sqlSourceReaders";

const ERROR = "Private managed research unavailable";
const fail: () => never = () => {
  throw Error(ERROR);
};
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const name = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(128),
  v.check((s) => s.isWellFormed()),
);
const oid = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(4294967295),
);
const corpusTargetShape = v.strictObject({
  database: name,
  role: name,
  datasetsOid: oid,
  unitsOid: oid,
  roleOid: v.optional(oid),
});
/** Independently adopted restricted reader target; hashes do not establish credential, endpoint or release custody. */
export type ResearchManagedCorpusNativeTarget = v.InferInput<
  typeof corpusTargetShape
>;
/** Private startup is loaded only after canonical operator authentication. The outer release owns actual credentials, target adoption and code custody. */
export interface ResearchManagedSqlPrivateOptions
  extends Omit<
    ResearchManagedOperatorStartupOptions,
    | "database"
    | "authOptions"
    | "preparedCorpus"
    | "preparedCatalog"
    | "independentlyAdoptedStartupSha256"
  > {
  readonly corpusDatabase: ResearchSourceDatabase;
  readonly corpusNativeTarget: ResearchManagedCorpusNativeTarget;
}
/** Cheap adopted pins and app auth only; neither a request nor an unreviewed startup may choose these values. */
export interface ResearchManagedSqlServiceOptions {
  readonly origin: string;
  readonly operatorId: string;
  readonly startupSha256: string;
  readonly authNativeTarget?: ResearchManagedNativeRole;
  readonly database: ResearchManagedOperatorStartupOptions["database"];
  readonly authOptions: ResearchManagedOperatorStartupOptions["authOptions"];
  readonly loadPrivateOptions: (
    signal: AbortSignal,
    deadlineAt: number,
  ) => Promise<ResearchManagedSqlPrivateOptions>;
}

/** Capture native identities in one fresh read-only statement before source/object reads. Does not adopt grants or prove effective ACLs/TLS/custody. */
async function native(
  database: ResearchSourceDatabase,
  expected: { database: string; role: string; roleOid?: number },
  tables: readonly { schema: string; name: string; oid: number }[],
  signal: AbortSignal,
  end: number,
) {
  const nativeRole =
    expected.roleOid === undefined
      ? undefined
      : prepareResearchManagedNativeRole({
          database: expected.database,
          role: expected.role,
          roleOid: expected.roleOid,
        });
  const active = () => {
    signal.throwIfAborted();
    if (performance.now() >= end) fail();
  };
  active();
  if (
    is(database, PgTransaction) ||
    "rollback" in database ||
    typeof database.transaction !== "function"
  )
    fail();
  let called = false;
  const rows = await database.transaction(
    async (tx) => {
      if (called) fail();
      called = true;
      const step = async <T>(work: () => PromiseLike<T>) => {
        active();
        const r = await work();
        active();
        return r;
      };
      await step(() =>
        tx.execute(sql`set local search_path=pg_catalog,pg_temp`),
      );
      await step(() => tx.execute(sql`set local lock_timeout='5s'`));
      await step(() => tx.execute(sql`set local statement_timeout='8s'`));
      return step(() =>
        tx
          .select({
            schema: sql<string>`n.nspname`,
            name: sql<string>`c.relname`,
            oid: sql<number>`c.oid::bigint`.mapWith(Number),
            database: sql<string>`pg_catalog.current_database()`,
            role: sql<string>`current_user`,
            readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
            isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
            ...(nativeRole ? researchManagedNativeRoleProjection() : {}),
            now: sql<number>`pg_catalog.floor(extract(epoch from pg_catalog.statement_timestamp())*1000)::double precision`.mapWith(
              Number,
            ),
          })
          .from(
            sql`pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace`,
          )
          .where(
            sql`c.relkind='r' and c.relpersistence='p' and (${sql.join(
              tables.map(
                (t) => sql`(n.nspname=${t.schema} and c.relname=${t.name})`,
              ),
              sql` or `,
            )})`,
          ),
      );
    },
    { isolationLevel: "read committed", accessMode: "read only" },
  );
  active();
  if (!called || rows.length !== tables.length) fail();
  const now = rows[0].now;
  if (!Number.isSafeInteger(now) || now < 0) fail();
  if (nativeRole)
    for (const row of rows) assertResearchManagedNativeRole(row, nativeRole);
  for (const table of tables) {
    const found = rows.filter(
      (r) => r.schema === table.schema && r.name === table.name,
    );
    if (
      found.length !== 1 ||
      found[0].oid !== table.oid ||
      found[0].database !== expected.database ||
      found[0].role !== expected.role ||
      found[0].now !== now ||
      found[0].readOnly !== "on" ||
      found[0].isolation !== "read committed"
    )
      fail();
  }
  return now;
}

/** HTTPS POST entry only. Each request authenticates before private loading and uses fresh SQL gates for every corpus object. Provider/settlement lifetimes remain owned by the existing core. */
export function createResearchManagedSqlService(
  options: ResearchManagedSqlServiceOptions,
) {
  try {
    const expectedOrigin = options.origin,
      operatorId = options.operatorId,
      startupSha256 = v.parse(hash, options.startupSha256),
      database = options.database,
      authNativeTarget =
        options.authNativeTarget === undefined
          ? undefined
          : prepareResearchManagedNativeRole(options.authNativeTarget),
      authOptions = copyResearchSourceAuthOptions(options.authOptions),
      u = new URL(expectedOrigin);
    if (
      u.origin !== expectedOrigin ||
      u.protocol !== "https:" ||
      authOptions.baseURL !== expectedOrigin ||
      !isUuidV7(operatorId) ||
      operatorId !== operatorId.toLowerCase()
    )
      fail();
    const transaction = database.transaction;
    if (
      typeof transaction !== "function" ||
      is(database, PgTransaction) ||
      "rollback" in database
    )
      fail();
    let inFlight = false,
      poisoned = false;
    return async function handleRequest(
      request: Request,
      inheritedIngressDeadlineAt?: number,
    ): Promise<Response> {
      let end = performance.now() + 8000;
      const pendingRoots = new Set<Promise<unknown>>();
      const tracked = async <T>(task: PromiseLike<T>) => {
        const promise = Promise.resolve(task);
        pendingRoots.add(promise);
        try {
          return await promise;
        } finally {
          pendingRoots.delete(promise);
        }
      };
      let bootstrapActive = true;
      let ownedSlot = false,
        startupSettled = false,
        startupStarted = false;
      let owned = request,
        response: Response | undefined;
      try {
        if (inheritedIngressDeadlineAt !== undefined) {
          if (!Number.isFinite(inheritedIngressDeadlineAt)) fail();
          end = Math.min(end, inheritedIngressDeadlineAt);
        }
        const method = request.method,
          url = request.url,
          headers = new Headers(request.headers),
          body = request.body,
          signal = request.signal;
        if (request.bodyUsed || body?.locked) return failure(400, body);
        owned = new Request(url, {
          method,
          headers,
          body,
          signal,
          duplex: "half",
        } as RequestInit);
        const active = () => {
          const sameRoot = database.transaction === transaction;
          signal.throwIfAborted();
          if (!sameRoot || performance.now() >= end) fail();
        };
        active();
        const parsed = new URL(url),
          path = parsed.pathname;
        if (
          ![
            RESEARCH_API_PATH,
            RESEARCH_CATALOG_API_PATH,
            RESEARCH_ARCHIVE_API_PATH,
            RESEARCH_READ_API_PATH,
          ].includes(path) ||
          parsed.search ||
          parsed.hash
        )
          return failure(404, body);
        if (method !== "POST") return failure(405, body);
        if (
          parsed.origin !== expectedOrigin ||
          headers.get("host") !== u.host ||
          headers.get("origin") !== expectedOrigin ||
          headers.get("sec-fetch-site") === "cross-site" ||
          headers.has("authorization") ||
          headers.has("next-action") ||
          headers.has("forwarded") ||
          headers.has("expect") ||
          [...headers.keys()].some((h) =>
            /^(?:x-middleware-|x-invoke-|x-nextjs-|x-now-route-matches$|x-matched-path$|next-url$|next-router-state-tree$)/.test(
              h,
            ),
          ) ||
          [
            ["x-forwarded-host", u.host],
            ["x-forwarded-proto", "https"],
            ["x-forwarded-port", u.port || "443"],
          ].some(([h, value]) => headers.has(h) && headers.get(h) !== value)
        )
          return failure(403, body);
        if (!jsonContentType(headers.get("content-type")))
          return failure(415, body);
        const limit =
          path === RESEARCH_API_PATH
            ? RESEARCH_HTTP_BODY_BYTE_LIMIT
            : path === RESEARCH_READ_API_PATH
              ? RESEARCH_READ_BODY_BYTE_LIMIT
              : 16;
        const length = headers.get("content-length");
        if (
          length !== null &&
          (!/^(0|[1-9][0-9]{0,8})$/.test(length) || Number(length) > limit)
        )
          return failure(413, body);
        if (inFlight || poisoned) return failure(429, body);
        inFlight = true;
        ownedSlot = true;
        const bindRoot = (
          root: ResearchSourceDatabase,
          method: ResearchSourceDatabase["transaction"],
        ) => {
          if (
            typeof method !== "function" ||
            is(root, PgTransaction) ||
            "rollback" in root
          )
            fail();
          const check = () => {
            const same = root.transaction === method;
            if (!same) fail();
            // After handoff, core SQL has independent provider/settlement bounds
            // and may deliberately outlive request cancellation or startup time.
            if (bootstrapActive) active();
          };
          const invoke = method.bind(
            root,
          ) as ResearchSourceDatabase["transaction"];
          type SourceTransaction = Parameters<
            Parameters<ResearchSourceDatabase["transaction"]>[0]
          >[0];
          const bound: ResearchSourceDatabase = Object.freeze({
            transaction: async <T>(
              work: (tx: SourceTransaction) => Promise<T>,
              config?: PgTransactionConfig,
            ): Promise<T> => {
              check();
              const value = await tracked(invoke(work, config));
              check();
              return value;
            },
          });
          return bound;
        };
        const authority = bindRoot(database, transaction);
        const handler = await withinResearchDeadline(
          signal,
          (bounded) => {
            startupStarted = true;
            const work = async () => {
              const principal =
                await readPrivateResearchManagedOperatorPrincipal(
                  authority,
                  authOptions,
                  headers,
                  bounded,
                  operatorId,
                  end,
                  authNativeTarget,
                );
              active();
              bounded.throwIfAborted();
              if (
                !principal ||
                typeof principal.deadlineAt !== "number" ||
                !Number.isFinite(principal.deadlineAt)
              )
                fail();
              end = Math.min(end, principal.deadlineAt);
              active();
              // Read the lazy loader slot only after canonical auth. No sticky startup,
              // corpus cache or remembered session can bypass this on the next request.
              const load = options.loadPrivateOptions;
              active();
              bounded.throwIfAborted();
              if (load instanceof Promise) {
                void load.catch(() => {});
                fail();
              }
              if (typeof load !== "function") fail();
              const privateOptions = await withinResearchDeadline(
                bounded,
                (privateSignal) => tracked(load(privateSignal, end)),
                end,
              );
              active();
              bounded.throwIfAborted();
              const startupJson = privateOptions.startupJson,
                startupInput = parseBoundedResearchJson(
                  startupJson,
                  RESEARCH_MANAGED_STARTUP_BYTE_LIMIT,
                ) as ResearchManagedOperatorStartupInput,
                startup = prepareResearchManagedOperatorStartup(startupInput);
              if (
                startup.documentJson !== startupJson ||
                startup.documentSha256 !== startupSha256 ||
                "corpusRoot" in privateOptions ||
                "preparedCorpus" in privateOptions ||
                "preparedCatalog" in privateOptions
              )
                fail();
              const document = JSON.parse(
                  startupInput.service_document_json,
                ) as ResearchConfiguredServiceDocument,
                publication = prepareResearchManagedPublication(
                  startupInput.publication_input,
                ),
                facts = inspectResearchManagedPublication(publication),
                scope = facts.target.scope,
                generation =
                  path === RESEARCH_API_PATH
                    ? privateOptions.generation
                    : "read-only",
                readerRoot = privateOptions.corpusDatabase,
                reader = bindRoot(readerRoot, readerRoot.transaction),
                readerTarget = Object.freeze(
                  v.parse(corpusTargetShape, privateOptions.corpusNativeTarget),
                ),
                mode =
                  path === RESEARCH_API_PATH
                    ? ("generation" as const)
                    : ("retained-read" as const);
              if (
                facts.source_policy.sources.some(
                  (source) => source.evidence_versions.length !== 1,
                ) ||
                document.origin !== expectedOrigin ||
                scope.actorId !== operatorId ||
                (mode === "generation" && generation === "read-only") ||
                readerTarget.datasetsOid === readerTarget.unitsOid ||
                readerRoot === database
              )
                fail();
              const authorityTables = [
                {
                  schema: facts.source_storage.schemaName,
                  name: "chat_research_source_policies",
                  oid: document.native_target.table_oids.policies,
                },
                {
                  schema: facts.target.maintenanceSchema,
                  name: "chat_research_maintenance",
                  oid: document.native_target.table_oids.maintenance,
                },
                ...(["windows", "permits", "artifacts"] as const).map(
                  (key) => ({
                    schema: facts.target.storage.schemaName,
                    name: `chat_research_${key}`,
                    oid: document.native_target.table_oids[key],
                  }),
                ),
                {
                  schema: facts.source_storage.authSchemaName,
                  name: "auth_user",
                  oid: document.native_target.table_oids.users,
                },
                {
                  schema: facts.source_storage.authSchemaName,
                  name: "auth_session",
                  oid: document.native_target.table_oids.sessions,
                },
              ];
              const now = await withinResearchDeadline(
                bounded,
                (nativeSignal) =>
                  native(
                    authority,
                    {
                      ...document.native_target,
                      ...(authNativeTarget
                        ? { roleOid: authNativeTarget.roleOid }
                        : {}),
                    },
                    authorityTables,
                    nativeSignal,
                    end,
                  ),
                end,
              );
              const expiresAt = Math.min(
                principal.expiresAt,
                mode === "generation" || path === RESEARCH_CATALOG_API_PATH
                  ? scope.expiresAtMs
                  : facts.read_until_ms,
              );
              if (now < scope.beginsAtMs || now >= expiresAt) fail();
              await withinResearchDeadline(
                bounded,
                (nativeSignal) =>
                  native(
                    reader,
                    readerTarget,
                    [
                      {
                        schema: "chat_research_corpus",
                        name: "datasets",
                        oid: readerTarget.datasetsOid,
                      },
                      {
                        schema: "chat_research_corpus",
                        name: "units",
                        oid: readerTarget.unitsOid,
                      },
                    ],
                    nativeSignal,
                    end,
                  ),
                end,
              );
              const context = parseResearchSourceContext({
                subject: principal.subject,
                corpus_version: scope.corpusVersion,
                expires_at_ms: expiresAt,
                bindings: facts.source_policy.sources.map((source, index) => ({
                  reference_id: `ref${index + 1}`,
                  source_id: source.source_id,
                  source_version: source.source_version,
                  evidence_version: source.evidence_versions[0],
                })),
                visible_reference_ids: [],
              });
              const descriptor = {
                  datasetId: document.corpus_manifest_sha256,
                  corpusVersion: scope.corpusVersion,
                },
                store =
                  mode === "generation"
                    ? createSqlResearchCorpusBundleStore(reader, descriptor)
                    : createSqlResearchCorpusMetadataStore(reader, descriptor);
              let corpus;
              try {
                const common = {
                  manifestSha256: descriptor.datasetId,
                  context,
                  ingressDeadlineAt: end,
                  createSourceReaders: () =>
                    mode === "generation"
                      ? createSqlResearchMaintenanceSourceReaders(
                          authority,
                          authOptions,
                          headers,
                          facts.source_storage,
                          { scope, storage: facts.target.storage },
                          {
                            scope,
                            storage: facts.target.storage,
                            maintenanceSchema: facts.target.maintenanceSchema,
                            profileSha256: facts.target.profileSha256,
                            artifactTableOid: facts.target.artifactTableOid,
                          },
                        )
                      : createSqlResearchSourceReaders(
                          authority,
                          authOptions,
                          headers,
                          facts.source_storage,
                        ),
                  readObject: store.readObject,
                };
                // Retained delivery does not extend the native generation scope. The
                // final retained-read policy owns its separate adopted access window.
                if (mode === "generation")
                  corpus = {
                    preparedCorpus: await loadResearchRemoteCorpus(
                      { ...common, mode: "generation" },
                      bounded,
                    ),
                  };
                else
                  corpus = {
                    preparedCatalog: await loadResearchRemoteCorpus(
                      { ...common, mode: "retained-read" },
                      bounded,
                    ),
                  };
              } finally {
                store.destroy();
              }
              active();
              bounded.throwIfAborted();
              const application = createResearchManagedOperatorStartup({
                startupJson,
                independentlyAdoptedStartupSha256: startupSha256,
                ...corpus,
                database: authority,
                authOptions,
                apiKey:
                  mode === "generation" ? privateOptions.apiKey : () => fail(),
                runtime: privateOptions.runtime,
                managedCleanupRuntime: privateOptions.managedCleanupRuntime,
                generation: mode === "retained-read" ? "read-only" : generation,
                priceFetch:
                  mode === "generation" ? privateOptions.priceFetch : undefined,
                requestFetch:
                  mode === "generation"
                    ? privateOptions.requestFetch
                    : undefined,
              });
              return path === RESEARCH_API_PATH
                ? application.handleQuestion
                : path === RESEARCH_CATALOG_API_PATH
                  ? application.handleCatalog
                  : path === RESEARCH_READ_API_PATH
                    ? application.handleRetainedRead
                    : application.handleArchive;
            };
            return work().finally(() => {
              startupSettled = true;
            });
          },
          end,
        );
        active();
        // The core repeats fresh native/session/source checks before admission
        // and delivery, and keeps its own provider/independent settlement bounds.
        bootstrapActive = false;
        response = await handler(owned, end);
        signal.throwIfAborted();
        return response;
      } catch {
        if (response) cancelBody(response.body);
        return failure(503, owned.body);
      } finally {
        if (ownedSlot) {
          if ((startupStarted && !startupSettled) || pendingRoots.size > 0)
            poisoned = true;
          inFlight = false;
        }
      }
    };
  } catch {
    return fail();
  }
}
