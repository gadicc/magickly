/** Concrete inactive startup composition. External deployment/launcher review remains the consent and runtime trust root. */
import "server-only";
import { createHash } from "node:crypto";
import { is, sql } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import * as v from "valibot";
import {
  inspectPreparedResearchCatalogView,
  type PreparedResearchCatalogView,
} from "./answerProvenance";
import {
  parseResearchAnswerArchive,
  RESEARCH_ARCHIVE_BYTE_LIMIT,
} from "./archive";
import { createSqlResearchArchiveHttpHandler } from "./archiveHttp";
import { parseBoundedResearchJson } from "./boundedJson";
import { withinResearchDeadline } from "./boundedWork";
import { createSqlResearchCatalogHttpHandler } from "./catalogHttp";
import { loadPrivateResearchCorpus } from "./corpusFiles";
import {
  createSqlResearchHttpHandler,
  type ResearchHttpAdoptionPorts,
  type ResearchHttpJobBinding,
  type ResearchHttpOptions,
  type ResearchHttpOutcomeBinding,
  type ResearchHttpServiceBinding,
} from "./http";
import {
  RESEARCH_API_PATH,
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
} from "./paths";
import {
  inspectResearchPublication,
  type PreparedResearchPublication,
} from "./publication";
import { inspectResearchQuery, type PreparedResearchQuery } from "./query";
import { createResearchReadAdoptionPorts } from "./readAdoption";
import { createSqlResearchReadHttpHandler } from "./readHttp";
import { inspectResearchRequestArtifact } from "./requestArtifact";
import type { ResearchRetainedArchiveBinding } from "./retainedArchive";
import type { ResearchRetainedReadBinding } from "./retainedDelivery";
import type { ResearchSourceContext } from "./sourceAuthorization";
import { parseResearchSourceContext } from "./sourceAuthorization";

export const RESEARCH_CONFIGURED_SERVICE_ERROR =
  "Private research startup unavailable";
const fail = (): never => {
  throw Error(RESEARCH_CONFIGURED_SERVICE_ERROR);
};
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
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
const runtimeShape = v.strictObject({
  kind: v.picklist(["reviewed-local-launch", "immutable-deployment"]),
  revision: hash,
});
const oidsShape = v.strictObject({
  policies: oid,
  maintenance: oid,
  windows: oid,
  permits: oid,
  artifacts: oid,
  users: oid,
  sessions: oid,
});
const shape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("private-operator-http-service"),
  publication_sha256: hash,
  corpus_manifest_sha256: hash,
  origin: v.string(),
  web_runtime: runtimeShape,
  authority_endpoint_identity: hash,
  native_target: v.strictObject({
    database: name,
    role: name,
    table_oids: oidsShape,
  }),
  ddl_contract: v.literal("outer-controlled-no-authority-table-ddl"),
});
/** Data-only reviewed startup metadata. Endpoint/code/DDL provenance is supplied by the outer trusted launcher, not proved by these fields. */
export type ResearchConfiguredServiceDocument = v.InferInput<typeof shape>;
function checkOrigin(value: string) {
  const u = new URL(value);
  if (
    u.origin !== value ||
    !(
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    )
  )
    fail();
  return value;
}
/** Canonical compilation only; does not create consent, dates, IDs, source permissions, tables or a spending window. */
export function prepareResearchConfiguredServiceDocument(
  input: ResearchConfiguredServiceDocument,
) {
  try {
    const p = v.parse(shape, input);
    checkOrigin(p.origin);
    if (new Set(Object.values(p.native_target.table_oids)).size !== 7) fail();
    const documentJson = JSON.stringify(p);
    if (Buffer.byteLength(documentJson) > 8192) fail();
    return Object.freeze({ documentJson, documentSha256: sha(documentJson) });
  } catch {
    return fail();
  }
}
/** Optional additional restriction supplied by a reviewed fixed-purpose driver.
 * It can only deny existing native/source/price authority, never replace it.
 * Persist work before the final native/source fence; readiness must be synchronous and I/O-free. */
export interface ResearchConfiguredGenerationPolicy {
  readonly createJobPorts: ResearchHttpAdoptionPorts["createJobPorts"];
}
/** Reviewed outer startup inputs only. Reuse one handler; no environment/credential/route or SQL writer is installed here. */
export interface ResearchConfiguredServiceOptions {
  readonly documentJson: string;
  readonly independentlyAdoptedDocumentSha256: string;
  readonly publication: PreparedResearchPublication;
  readonly corpusRoot: string;
  /** Actual already-created Loom root from the approved endpoint; endpoint provenance cannot be recovered from a generic SQL object. */
  readonly database: ResearchHttpOptions["database"];
  readonly authOptions: ResearchHttpOptions["authOptions"];
  readonly apiKey: ResearchHttpOptions["apiKey"];
  /** Actual outer launch/deployment facts, separate from the cleanup-worker runtime. Equality is configuration checking, not execution attestation. */
  readonly runtime: Readonly<{
    kind: v.InferInput<typeof runtimeShape>["kind"];
    revision: string;
    authorityEndpointIdentity: string;
  }>;
  /** Read-only previews refuse questions before auth, credential, pricing or reservation work.
   * A driver policy adds exact-operation checks before native admission and at each handoff.
   * Omission preserves the existing generic inactive factory; it is not trial activation. */
  readonly generation?: "read-only" | ResearchConfiguredGenerationPolicy;
  readonly priceFetch?: typeof fetch;
  readonly requestFetch?: typeof fetch;
}
/**
 * Load the actual independently pinned private bundle and internally construct real HTTP adoption guards.
 * The outer reviewed immutable deployment/non-watch launcher owns consent, code and authoritative endpoint,
 * and must keep all seven authority tables, schema mappings and security-critical triggers,
 * functions and privileges controlled while the service is active. The outer deployment also owns
 * the Gateway key account/secret-source provenance; an API-key string cannot establish it.
 * Native checks below prove compatibility at their decision point; they are not atomic protection against
 * subsequent owner/admin DDL. Fresh source/session/window/health/price and durable accounting remain mandatory.
 */
export function createConfiguredResearchApplication(
  options: ResearchConfiguredServiceOptions,
) {
  try {
    const prepared = prepareResearchConfiguredServiceDocument(
      parseBoundedResearchJson(
        options.documentJson,
        8192,
      ) as ResearchConfiguredServiceDocument,
    );
    if (
      prepared.documentJson !== options.documentJson ||
      prepared.documentSha256 !==
        v.parse(hash, options.independentlyAdoptedDocumentSha256)
    )
      fail();
    const document = JSON.parse(
        prepared.documentJson,
      ) as ResearchConfiguredServiceDocument,
      facts = inspectResearchPublication(options.publication),
      database = options.database,
      transaction = database.transaction,
      actualRuntime = {
        kind: options.runtime.kind,
        revision: options.runtime.revision,
      },
      scope = facts.target.scope,
      generation = options.generation,
      createGenerationPorts =
        generation === undefined || generation === "read-only"
          ? undefined
          : generation?.createJobPorts;
    if (
      generation !== undefined &&
      generation !== "read-only" &&
      typeof createGenerationPorts !== "function"
    )
      fail();
    if (
      is(database, PgTransaction) ||
      "rollback" in database ||
      typeof transaction !== "function" ||
      facts.document_sha256 !== document.publication_sha256 ||
      JSON.stringify(actualRuntime) !== JSON.stringify(document.web_runtime) ||
      options.runtime.authorityEndpointIdentity !==
        document.authority_endpoint_identity ||
      document.native_target.table_oids.artifacts !==
        facts.target.artifactTableOid
    )
      fail();
    const runTransaction: typeof transaction = transaction.bind(database);
    // Own the real loader's ports; an arbitrary object's claimed manifest/catalog revision is insufficient.
    const loaded = loadPrivateResearchCorpus(
      options.corpusRoot,
      document.corpus_manifest_sha256,
    );
    if (loaded.catalog.revision !== scope.corpusVersion) fail();
    const expected = JSON.stringify([
        scope,
        facts.target.storage,
        facts.source_storage,
      ]),
      tables = [
        {
          key: "policies" as const,
          schema: facts.source_storage.schemaName,
          name: "chat_research_source_policies",
        },
        {
          key: "maintenance" as const,
          schema: facts.target.maintenanceSchema,
          name: "chat_research_maintenance",
        },
        {
          key: "windows" as const,
          schema: facts.target.storage.schemaName,
          name: "chat_research_windows",
        },
        {
          key: "permits" as const,
          schema: facts.target.storage.schemaName,
          name: "chat_research_permits",
        },
        {
          key: "artifacts" as const,
          schema: facts.target.storage.schemaName,
          name: "chat_research_artifacts",
        },
        {
          key: "users" as const,
          schema: facts.source_storage.authSchemaName,
          name: "auth_user",
        },
        {
          key: "sessions" as const,
          schema: facts.source_storage.authSchemaName,
          name: "auth_session",
        },
      ],
      sourceBindings = new Map(
        facts.source_policy.sources.map((s) => [s.source_id, s]),
      );
    function base(
      binding: ResearchHttpServiceBinding,
      signal: AbortSignal,
    ): undefined {
      signal.throwIfAborted();
      if (
        database.transaction !== transaction ||
        binding.database !== database ||
        binding.publication_sha256 !== document.publication_sha256 ||
        binding.origin !== document.origin ||
        binding.catalog_revision !== loaded.catalog.revision ||
        JSON.stringify([
          binding.scope,
          binding.storage,
          binding.source_storage,
        ]) !== expected
      )
        fail();
      return undefined;
    }
    function sourceContext(context: ResearchSourceContext) {
      if (
        context.subject.kind !== "user" ||
        context.subject.user_id !== scope.actorId ||
        context.corpus_version !== scope.corpusVersion ||
        context.bindings.length !== sourceBindings.size ||
        new Set(context.bindings.map((b) => b.source_id)).size !==
          sourceBindings.size ||
        context.bindings.some((b) => {
          const s = sourceBindings.get(b.source_id);
          return (
            !s ||
            s.source_version !== b.source_version ||
            !s.evidence_versions.includes(b.evidence_version)
          );
        })
      )
        fail();
    }
    async function observe(
      purpose: "generation" | "retained-read",
      signal: AbortSignal,
      until = scope.expiresAtMs,
      inheritedEnd = Infinity,
    ) {
      const started = performance.now(),
        end = Math.min(started + 8000, inheritedEnd);
      let called = false;
      const rows = await withinResearchDeadline(
        signal,
        async (bounded) =>
          runTransaction(
            async (tx) => {
              if (called) fail();
              called = true;
              const active = () => {
                bounded.throwIfAborted();
                if (performance.now() >= end) fail();
              };
              const step = async <T>(
                work: () => PromiseLike<T>,
              ): Promise<T> => {
                active();
                const result = await work();
                active();
                return result;
              };
              active();
              await step(() =>
                tx.execute(sql`set local search_path=pg_catalog,pg_temp`),
              );
              await step(() => tx.execute(sql`set local lock_timeout='5s'`));
              await step(() =>
                tx.execute(sql`set local statement_timeout='8s'`),
              );
              const result = await step(() =>
                tx
                  .select({
                    schema: sql<string>`n.nspname`,
                    name: sql<string>`c.relname`,
                    oid: sql<number>`c.oid::bigint`.mapWith(Number),
                    database: sql<string>`pg_catalog.current_database()`,
                    role: sql<string>`current_user`,
                    readOnly: sql<string>`pg_catalog.current_setting('transaction_read_only')`,
                    isolation: sql<string>`pg_catalog.current_setting('transaction_isolation')`,
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
                        (t) =>
                          sql`(n.nspname=${t.schema} and c.relname=${t.name})`,
                      ),
                      sql` or `,
                    )})`,
                  ),
              );
              bounded.throwIfAborted();
              return result;
            },
            { isolationLevel: "read committed", accessMode: "read only" },
          ),
        end,
      );
      if (!called || rows.length !== 7) fail();
      const now = rows[0].now;
      if (!Number.isSafeInteger(now) || now < scope.beginsAtMs) fail();
      for (const t of tables) {
        const found = rows.filter(
          (r) => r.schema === t.schema && r.name === t.name,
        );
        if (
          found.length !== 1 ||
          found[0].oid !== document.native_target.table_oids[t.key] ||
          found[0].database !== document.native_target.database ||
          found[0].role !== document.native_target.role ||
          found[0].now !== now ||
          found[0].readOnly !== "on" ||
          found[0].isolation !== "read committed"
        )
          fail();
      }
      signal.throwIfAborted();
      if (performance.now() >= end) fail();
      const cap =
        purpose === "generation" ? scope.expiresAtMs : facts.read_until_ms;
      const deadline = Math.min(end, started + Math.min(cap, until) - now);
      const check = (): undefined => {
        signal.throwIfAborted();
        if (
          database.transaction !== transaction ||
          performance.now() >= deadline
        )
          fail();
        return undefined;
      };
      check();
      return check;
    }
    const outcomes = new WeakMap<PreparedResearchQuery, () => undefined>();
    const outcome = (
      binding: ResearchHttpOutcomeBinding,
      signal: AbortSignal,
    ) => {
      base(binding.service, signal);
      const query = inspectResearchQuery(binding.query);
      if (query.outcome === "ready") fail();
      sourceContext(query.context);
      return query;
    };
    const questionHandler = createSqlResearchHttpHandler({
      database,
      authOptions: options.authOptions,
      publication: options.publication,
      independentlyAdoptedManifestSha256: document.publication_sha256,
      origin: document.origin,
      catalog: loaded.catalog,
      search: loaded.search,
      materialize: loaded.materialize,
      apiKey: options.apiKey,
      priceFetch: options.priceFetch,
      requestFetch: options.requestFetch,
      adoption: {
        async requireRequestActive(binding, signal) {
          const end = performance.now() + 8000;
          base(binding, signal);
          await observe("generation", signal, scope.expiresAtMs, end);
        },
        async requireOutcomeActive(binding, signal) {
          const end = performance.now() + 8000;
          outcomes.delete(binding.query);
          const query = outcome(binding, signal);
          outcomes.set(
            binding.query,
            await observe(
              "generation",
              signal,
              query.context.expires_at_ms,
              end,
            ),
          );
        },
        assertOutcomeReady(binding, signal) {
          const ready = outcomes.get(binding.query);
          outcomes.delete(binding.query);
          outcome(binding, signal);
          if (!ready) return fail();
          return ready();
        },
        async createJobPorts(binding: ResearchHttpJobBinding, signal) {
          const end = performance.now() + 8000;
          base(binding.service, signal);
          const packet = inspectResearchRequestArtifact(
              binding.artifact,
            ).packet,
            quote = Object.freeze({ ...binding.quote });
          if (
            binding.database !== database ||
            JSON.stringify([binding.scope, binding.storage]) !==
              JSON.stringify([scope, facts.target.storage]) ||
            packet.window_id !== scope.windowId ||
            packet.model !== scope.model ||
            packet.processor_profile !== scope.processorProfile ||
            quote.request_artifact_sha256 !== binding.artifact.revision ||
            !Number.isSafeInteger(quote.upperPico) ||
            quote.upperPico < 1 ||
            quote.upperPico > scope.perRequestPico ||
            !Number.isSafeInteger(quote.quoteExpiresAtMs)
          )
            fail();
          sourceContext(packet.context);
          // This is before the coordinator can reserve a native permit.
          const policy =
            createGenerationPorts === undefined
              ? undefined
              : await createGenerationPorts(binding, signal);
          signal.throwIfAborted();
          // Capture once: changing getters cannot pass validation and then remove a restriction.
          const requirePolicy = policy?.requireActive,
            assertPolicy = policy?.assertHandoffReady;
          if (
            performance.now() >= end ||
            (createGenerationPorts !== undefined &&
              (typeof requirePolicy !== "function" ||
                typeof assertPolicy !== "function"))
          )
            fail();
          await observe(
            "generation",
            signal,
            packet.context.expires_at_ms,
            end,
          );
          const stages = new Map<string, () => undefined>();
          return Object.freeze({
            async requireActive(stage, stageSignal) {
              const end = performance.now() + 8000;
              stages.delete(stage);
              if (!["prepare", "dispatch", "delivery"].includes(stage)) fail();
              if (requirePolicy !== undefined) {
                const result: unknown = await requirePolicy(stage, stageSignal);
                if (result !== undefined) fail();
              }
              stageSignal.throwIfAborted();
              if (performance.now() >= end) fail();
              base(binding.service, stageSignal);
              stages.set(
                stage,
                await observe(
                  "generation",
                  stageSignal,
                  Math.min(
                    packet.context.expires_at_ms,
                    stage === "delivery"
                      ? scope.expiresAtMs
                      : quote.quoteExpiresAtMs,
                  ),
                  end,
                ),
              );
            },
            assertHandoffReady(stage, stageSignal) {
              if (stage !== "dispatch" && stage !== "delivery") fail();
              const ready = stages.get(stage);
              stages.delete(stage);
              if (assertPolicy !== undefined) {
                const result: unknown = assertPolicy(stage, stageSignal);
                if (result !== undefined) {
                  void Promise.resolve(result).catch(() => {});
                  fail();
                }
              }
              base(binding.service, stageSignal);
              if (!ready) return fail();
              return ready();
            },
          });
        },
      },
    });
    const handleQuestion =
      generation === "read-only"
        ? async (request: Request): Promise<Response> => {
            try {
              if (request.body && !request.body.locked)
                void request.body.cancel().catch(() => {});
            } catch {}
            return Response.json(
              { error: "Private research generation disabled" },
              {
                status: 403,
                headers: {
                  "cache-control": "private, no-store, max-age=0",
                  vary: "Cookie",
                  "x-content-type-options": "nosniff",
                  "x-robots-tag": "noindex, nofollow",
                },
              },
            );
          }
        : questionHandler;
    const readAdoption = createResearchReadAdoptionPorts({
      adoptedDocumentSha256: facts.read_envelope_sha256,
      documentJson: facts.read_envelope_json,
      database,
      scope,
      storage: facts.target.storage,
      sourceStorage: facts.source_storage,
    });
    const reads = new WeakMap<ResearchRetainedReadBinding, () => undefined>();
    const checkRead = (
      binding: ResearchRetainedReadBinding,
      signal: AbortSignal,
    ) => {
      signal.throwIfAborted();
      if (database.transaction !== transaction) fail();
      if (binding.completed)
        sourceContext(
          parseResearchSourceContext(
            parseBoundedResearchJson(
              binding.completed.original_source_context_json,
              64 * 1024,
            ),
          ),
        );
    };
    const handleRetainedRead = createSqlResearchReadHttpHandler({
      database,
      scope,
      storage: facts.target.storage,
      sourceStorage: facts.source_storage,
      authOptions: options.authOptions,
      origin: document.origin,
      readUntilMs: readAdoption.readUntilMs,
      async requireServiceReadActive(signal, end) {
        if (database.transaction !== transaction) fail();
        await observe("retained-read", signal, facts.read_until_ms, end);
      },
      async requireReadActive(stage, binding, signal, inheritedEnd) {
        reads.delete(binding);
        if (inheritedEnd === undefined || !Number.isFinite(inheritedEnd))
          fail();
        const end = Math.min(performance.now() + 8000, inheritedEnd!);
        checkRead(binding, signal);
        await readAdoption.requireReadActive(stage, binding, signal);
        signal.throwIfAborted();
        if (performance.now() >= end) fail();
        const ready = await observe(
          "retained-read",
          signal,
          Math.min(
            facts.read_until_ms,
            binding.completed?.retain_until_ms ?? Infinity,
          ),
          end,
        );
        checkRead(binding, signal);
        if (stage === "delivery") reads.set(binding, ready);
      },
      assertReadReady(binding, signal) {
        const ready = reads.get(binding);
        reads.delete(binding);
        checkRead(binding, signal);
        readAdoption.assertReadReady(binding, signal);
        if (!ready) return fail();
        return ready();
      },
    });
    const catalogReads = new WeakMap<
      PreparedResearchCatalogView,
      () => undefined
    >();
    const checkCatalog = (
      view: PreparedResearchCatalogView,
      signal: AbortSignal,
    ) => {
      signal.throwIfAborted();
      if (database.transaction !== transaction) fail();
      const prepared = inspectPreparedResearchCatalogView(view);
      sourceContext(prepared.context);
      if (
        prepared.context.expires_at_ms > scope.expiresAtMs ||
        prepared.value.catalog_revision !== loaded.catalog.revision
      )
        fail();
      return prepared;
    };
    const handleCatalog = createSqlResearchCatalogHttpHandler({
      database,
      authOptions: options.authOptions,
      sourceStorage: facts.source_storage,
      actorId: scope.actorId,
      origin: document.origin,
      catalog: loaded.catalog,
      expiresAtMs: scope.expiresAtMs,
      async requireServiceReadActive(signal, end) {
        if (database.transaction !== transaction) fail();
        await observe("generation", signal, scope.expiresAtMs, end);
      },
      async requireCatalogActive(view, signal, end) {
        catalogReads.delete(view);
        const prepared = checkCatalog(view, signal);
        const ready = await observe(
          "generation",
          signal,
          prepared.context.expires_at_ms,
          end,
        );
        checkCatalog(view, signal);
        catalogReads.set(view, ready);
      },
      assertCatalogReady(view, signal) {
        const ready = catalogReads.get(view);
        catalogReads.delete(view);
        checkCatalog(view, signal);
        if (!ready) return fail();
        return ready();
      },
    });
    const archives = new WeakMap<
      ResearchRetainedArchiveBinding,
      () => undefined
    >();
    const checkArchive = (
      stage: "prepare" | "delivery",
      binding: ResearchRetainedArchiveBinding,
      signal: AbortSignal,
    ) => {
      readAdoption.assertReadServiceScope(binding, signal);
      if (
        database.transaction !== transaction ||
        binding.kind !== "retained_answer_archive"
      )
        fail();
      const prepared = inspectPreparedResearchCatalogView(binding.view);
      sourceContext(prepared.context);
      if (
        prepared.context.expires_at_ms > facts.read_until_ms ||
        prepared.context.subject.user_id !== binding.current_subject.user_id ||
        prepared.context.subject.session_id !==
          binding.current_subject.session_id
      )
        fail();
      if (stage === "prepare") {
        if (
          binding.completed !== null ||
          binding.archive_json !== null ||
          binding.archive_sha256 !== null
        )
          fail();
        return;
      }
      if (
        stage !== "delivery" ||
        !binding.completed ||
        typeof binding.archive_json !== "string" ||
        binding.archive_sha256 !== sha(binding.archive_json)
      )
        fail();
      const value = parseResearchAnswerArchive(
        parseBoundedResearchJson(
          binding.archive_json!,
          RESEARCH_ARCHIVE_BYTE_LIMIT,
        ),
      );
      if (
        JSON.stringify(value) !== binding.archive_json ||
        value.entries.length !== binding.completed!.length
      )
        fail();
      binding.completed!.forEach((entry, i) => {
        if (
          entry.permit_id !== value.entries[i].permit_id ||
          entry.completed.answer_id !== value.entries[i].answer_id
        )
          fail();
        readAdoption.assertReadReady(
          {
            ...binding,
            permit_id: entry.permit_id,
            completed: entry.completed,
          },
          signal,
        );
        sourceContext(
          parseResearchSourceContext(
            parseBoundedResearchJson(
              entry.completed.original_source_context_json,
              64 * 1024,
            ),
          ),
        );
      });
    };
    const handleArchive = createSqlResearchArchiveHttpHandler({
      database,
      scope,
      storage: facts.target.storage,
      sourceStorage: facts.source_storage,
      authOptions: options.authOptions,
      catalog: loaded.catalog,
      readUntilMs: readAdoption.readUntilMs,
      origin: document.origin,
      async requireServiceReadActive(signal, end) {
        if (database.transaction !== transaction) fail();
        await observe("retained-read", signal, facts.read_until_ms, end);
      },
      async requireArchiveActive(stage, binding, signal, end) {
        archives.delete(binding);
        if (!Number.isFinite(end)) fail();
        checkArchive(stage, binding, signal);
        const ready = await observe(
          "retained-read",
          signal,
          Math.min(
            facts.read_until_ms,
            ...(binding.completed ?? []).map(
              (e) => e.completed.retain_until_ms,
            ),
          ),
          end,
        );
        checkArchive(stage, binding, signal);
        if (stage === "delivery") archives.set(binding, ready);
      },
      assertArchiveReady(binding, signal) {
        const ready = archives.get(binding);
        archives.delete(binding);
        checkArchive("delivery", binding, signal);
        if (!ready) return fail();
        return ready();
      },
    });
    return Object.freeze({
      handleQuestion,
      handleRetainedRead,
      handleCatalog,
      handleArchive,
      /** Closed same-origin private paths only. Each handler owns its request authentication and limits. */
      handleRequest(request: Request, deadlineAt?: number): Promise<Response> {
        const path = new URL(request.url).pathname;
        if (path === RESEARCH_API_PATH)
          return handleQuestion(request, deadlineAt);
        if (path === RESEARCH_CATALOG_API_PATH)
          return handleCatalog(request, deadlineAt);
        if (path === RESEARCH_ARCHIVE_API_PATH)
          return handleArchive(request, deadlineAt);
        if (path === RESEARCH_READ_API_PATH)
          return handleRetainedRead(request, deadlineAt);
        try {
          if (request.body && !request.body.locked)
            void request.body.cancel().catch(() => {});
        } catch {}
        return Promise.resolve(
          Response.json(
            { error: "Private research unavailable" },
            {
              status: 404,
              headers: {
                "cache-control": "private, no-store, max-age=0",
                vary: "Cookie",
                "x-content-type-options": "nosniff",
              },
            },
          ),
        );
      },
    });
  } catch {
    return fail();
  }
}
/** Compatible question-only composition. The actual common constructor also owns provider-independent completed-answer reads. */
export function createConfiguredResearchHttpService(
  options: ResearchConfiguredServiceOptions,
) {
  return createConfiguredResearchApplication(options).handleQuestion;
}
