/** Inactive authenticated request composition. No environment/key reader, route export, activation writer or live singleton. */
import "server-only";
import { createUuidV7 } from "../lib/ids";
import { researchQueryOutcomeAnswer } from "./answer";
import {
  inspectPreparedResearchCatalogView,
  prepareResearchCatalogView,
  type ResearchCatalog,
  ungrantedResearchCatalogPolicy,
} from "./answerProvenance";
import { createResearchAnswerResponse } from "./answerResponse";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  createResearchAnswerJob,
  type ResearchAnswerJobOptions,
  type ResearchJobPriceBinding,
} from "./coordinator";
import { createResearchGenerationSourcePorts } from "./generationSourcePorts";
import type { ResearchHistoryPreparation } from "./historyInput";
import {
  failure,
  fault,
  HttpFault,
  jsonContentType,
  origin,
  RESEARCH_HTTP_ERROR,
  readBody,
} from "./httpIngress";
import {
  freezeResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
} from "./modelRequest";
import {
  createResearchPriceObserver,
  createResearchQuotePort,
  observeResearchQuoteClock,
  prepareResearchQuote,
} from "./pricing";
import {
  inspectResearchManagedPublication,
  inspectResearchPublication,
  type PreparedResearchManagedPublication,
  type PreparedResearchPublication,
  type ResearchPublicationFacts,
} from "./publication";
import { inspectResearchQuery, type PreparedResearchQuery } from "./query";
import {
  parseResearchQuestion,
  RESEARCH_HTTP_BODY_BYTE_LIMIT,
} from "./request";
import { prepareResearchRequestArtifact } from "./requestArtifact";
import {
  RESEARCH_LOCAL_RETRIEVAL_PROFILE,
  type ResearchRetrievalOptions,
  retrieveResearchQuery,
} from "./retrieval";
import {
  parseResearchSourcePrincipal,
  requireResearchSourceAccess,
  withResearchSourceDelivery,
} from "./sourceAuthorization";
import { prepareResearchSourcePolicy } from "./sourcePolicy";
import {
  createSqlResearchAdmission,
  type ResearchAdmissionDatabase,
} from "./sqlAdmission";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchMaintenanceSourceReaders,
  createSqlResearchWindowSourceReaders,
  type ResearchSourceAuthOptions,
  type ResearchSourceDatabase,
} from "./sqlSourceReaders";

export { RESEARCH_HTTP_ERROR } from "./httpIngress";
export { RESEARCH_HTTP_BODY_BYTE_LIMIT } from "./request";
/** Artifact-independent service identity for request admission only, never a model/source/spending capability. */
export interface ResearchHttpServiceBinding {
  readonly database: ResearchAdmissionDatabase & ResearchSourceDatabase;
  readonly publication_sha256: string;
  readonly origin: string;
  readonly catalog_revision: string;
  readonly scope: ReturnType<
    typeof inspectResearchPublication
  >["target"]["scope"];
  readonly storage: ReturnType<
    typeof inspectResearchPublication
  >["target"]["storage"];
  readonly source_storage: ReturnType<
    typeof inspectResearchPublication
  >["source_storage"];
}
/** Exact successful local-query outcome only; there is no fabricated provider artifact or retained-answer authority. */
export interface ResearchHttpOutcomeBinding {
  readonly service: ResearchHttpServiceBinding;
  readonly query: PreparedResearchQuery;
}
/** Actual private compiled operation and quote, bound only after both exist. */
export interface ResearchHttpJobBinding extends ResearchJobPriceBinding {
  readonly service: ResearchHttpServiceBinding;
}
/** Actual trusted startup implementations remain required. Throw to refuse; only undefined is successful. No callback or matching hash proves adoption by itself. */
export interface ResearchHttpAdoptionPorts {
  requireRequestActive(
    binding: ResearchHttpServiceBinding,
    signal: AbortSignal,
  ): Promise<void>;
  requireOutcomeActive(
    binding: ResearchHttpOutcomeBinding,
    signal: AbortSignal,
  ): Promise<void>;
  assertOutcomeReady(
    binding: ResearchHttpOutcomeBinding,
    signal: AbortSignal,
  ): undefined;
  createJobPorts(
    binding: ResearchHttpJobBinding,
    signal: AbortSignal,
  ): Promise<
    Pick<ResearchAnswerJobOptions, "requireActive" | "assertHandoffReady">
  >;
}
/** Server-only configuration. These ports must come from reviewed trusted startup; a hash or callback does not establish adoption. */
export interface ResearchHttpOptions {
  readonly database: ResearchAdmissionDatabase & ResearchSourceDatabase;
  readonly authOptions: ResearchSourceAuthOptions;
  readonly publication: PreparedResearchPublication;
  readonly independentlyAdoptedManifestSha256: string;
  readonly origin: string;
  readonly catalog: ResearchCatalog;
  readonly search: ResearchRetrievalOptions["search"];
  readonly materialize: ResearchRetrievalOptions["materialize"];
  /** Captured credential or synchronous trusted server resolver; used once only for a ready job, before price/reservation. */
  readonly apiKey: string | (() => string);
  readonly adoption: ResearchHttpAdoptionPorts;
  /** Fixed credential-free public-price fetch only; never used as the private model sender. */
  readonly priceFetch?: typeof fetch;
  /** Fixed provider sender only. No endpoint/provider is accepted from a request. */
  readonly requestFetch?: typeof fetch;
}
/** Explicit managed counterpart; local constructors continue to reject managed handles. */
export interface ResearchManagedHttpOptions
  extends Omit<ResearchHttpOptions, "publication"> {
  readonly publication: PreparedResearchManagedPublication;
}
/**
 * Own the entire bounded question HTTP pipeline with actual fresh SQL identity/source readers. Constructor/import performs no I/O.
 * No route is enabled here. The caller must independently verify code/target/audience/source/retention/provider adoption before supplying ports.
 * Each ready POST is a new server operation; this API promises no automatic replay, history selection or refund.
 */
export function createSqlResearchHttpHandler(options: ResearchHttpOptions) {
  return createHandler(
    options,
    inspectResearchPublication(options.publication),
  );
}
/** Managed entry with identical native/session/source/budget/provider fences. Constructor performs no I/O and activates no route. */
export function createSqlResearchManagedHttpHandler(
  options: ResearchManagedHttpOptions,
) {
  return createHandler(
    options,
    inspectResearchManagedPublication(options.publication),
  );
}
function createHandler(
  options: Omit<ResearchHttpOptions, "publication">,
  facts: ResearchPublicationFacts,
) {
  const originalTarget = facts.target,
    target = Object.freeze({
      ...originalTarget,
      scope: Object.freeze({ ...originalTarget.scope }),
      storage: Object.freeze({ ...originalTarget.storage }),
    });
  if (
    facts.document_sha256 !== options.independentlyAdoptedManifestSha256 ||
    target.scope.model !== RESEARCH_MODEL_ID ||
    target.scope.processorProfile !== RESEARCH_PROCESSOR_PROFILE ||
    prepareResearchSourcePolicy(ungrantedResearchCatalogPolicy(options.catalog))
      .corpusVersion !== target.scope.corpusVersion
  )
    throw Error(RESEARCH_HTTP_ERROR);
  for (const source of facts.source_policy.sources)
    if (
      !source.rights.processor_profiles.includes(
        RESEARCH_LOCAL_RETRIEVAL_PROFILE,
      ) ||
      !source.grants[0].capabilities.processor_profiles.includes(
        RESEARCH_LOCAL_RETRIEVAL_PROFILE,
      )
    )
      throw Error(RESEARCH_HTTP_ERROR);
  const database = options.database,
    settings = copyResearchSourceAuthOptions(options.authOptions),
    catalog = options.catalog,
    search = options.search,
    materialize = options.materialize,
    apiKey = options.apiKey,
    adoption = Object.freeze({ ...options.adoption }),
    requestFetch = options.requestFetch,
    priceFetch = options.priceFetch,
    expectedOrigin = origin(options.origin);
  if (
    [
      search,
      materialize,
      adoption.requireRequestActive,
      adoption.requireOutcomeActive,
      adoption.assertOutcomeReady,
      adoption.createJobPorts,
    ].some((f) => typeof f !== "function")
  )
    throw Error(RESEARCH_HTTP_ERROR);
  const maintenance = {
      scope: target.scope,
      storage: target.storage,
      maintenanceSchema: target.maintenanceSchema,
      profileSha256: target.profileSha256,
      artifactTableOid: target.artifactTableOid,
    },
    window = { scope: target.scope, storage: target.storage },
    sourceStorage = Object.freeze({ ...facts.source_storage });
  const service = Object.freeze({
    database,
    publication_sha256: facts.document_sha256,
    origin: expectedOrigin,
    catalog_revision: catalog.revision,
    scope: target.scope,
    storage: target.storage,
    source_storage: sourceStorage,
  });
  const sourceReaders = (headers: Headers, delivery = false) =>
    delivery
      ? createSqlResearchWindowSourceReaders(
          database,
          settings,
          headers,
          sourceStorage,
          window,
        )
      : createSqlResearchMaintenanceSourceReaders(
          database,
          settings,
          headers,
          sourceStorage,
          window,
          maintenance,
        );
  // Actual reader construction validates the supported root and exact target without reading auth or SQL.
  sourceReaders(new Headers());
  let inFlight = false;
  return async function handle(
    request: Request,
    inheritedIngressDeadlineAt?: number,
  ): Promise<Response> {
    let ownedSlot = false,
      ownedBody: Request["body"] = null,
      unreturnedResponse: Response | undefined,
      principalEnd = NaN;
    const enteredAt = performance.now();
    let ingressDeadline = enteredAt + RESEARCH_OPERATION_TIMEOUT_MS;
    try {
      const originalSignal = request.signal,
        headers = new Headers(request.headers);
      ownedBody = request.body;
      if (
        inheritedIngressDeadlineAt !== undefined &&
        !Number.isFinite(inheritedIngressDeadlineAt)
      )
        throw Error(RESEARCH_HTTP_ERROR);
      ingressDeadline = Math.min(
        enteredAt + RESEARCH_OPERATION_TIMEOUT_MS,
        inheritedIngressDeadlineAt ?? Infinity,
      );
      originalSignal.throwIfAborted();
      if (request.method !== "POST") fault(405);
      if (
        new URL(request.url).origin !== expectedOrigin ||
        headers.get("origin") !== expectedOrigin ||
        headers.get("sec-fetch-site") === "cross-site"
      )
        fault(403);
      if (!jsonContentType(headers.get("content-type"))) fault(415);
      if (request.bodyUsed || ownedBody?.locked) fault(400);
      const length = headers.get("content-length");
      if (
        length !== null &&
        (!/^(0|[1-9][0-9]{0,8})$/.test(length) ||
          Number(length) > RESEARCH_HTTP_BODY_BYTE_LIMIT)
      )
        fault(413);
      if (inFlight) fault(429);
      inFlight = true;
      ownedSlot = true;
      await withinResearchDeadline(
        originalSignal,
        async (s) => {
          const result: unknown = await adoption.requireRequestActive(
            service,
            s,
          );
          if (result !== undefined) throw Error(RESEARCH_HTTP_ERROR);
        },
        ingressDeadline,
      );
      const principal = await withinResearchDeadline(
        originalSignal,
        async (signal) => {
          const started = performance.now(),
            bootstrap = new AbortController();
          try {
            const readers = sourceReaders(headers),
              raw = await readers.readPrincipal(
                AbortSignal.any([signal, bootstrap.signal]),
              );
            // Existing source readers deliberately collapse missing auth and reader/SQL failures. Keep503 for this undistinguished boundary.
            const current = parseResearchSourcePrincipal(raw);
            const nativeNow = readers.now();
            if (
              current.expires_at_ms <=
              nativeNow + Math.ceil(performance.now() - started)
            )
              throw Error(RESEARCH_HTTP_ERROR);
            principalEnd = started + current.expires_at_ms - nativeNow;
            return current;
          } finally {
            bootstrap.abort();
          }
        },
        ingressDeadline,
      );
      if (principal.subject.user_id !== target.scope.actorId) fault(403);
      const body = await readBody(
        request,
        ownedBody,
        headers,
        originalSignal,
        ingressDeadline,
        parseResearchQuestion,
        RESEARCH_HTTP_BODY_BYTE_LIMIT,
        512,
      );
      if (
        body.expected_catalog_revision !== undefined &&
        body.expected_catalog_revision !== catalog.revision
      )
        fault(409);
      if (
        body.source_book_handles.some(
          (h) => Number(h.slice(4)) > catalog.sourceCount,
        )
      )
        fault(409);
      const {
        expected_catalog_revision: _catalogHint,
        previous_answer: priorHint,
        ...retrievalRequest
      } = body;
      let history: ResearchHistoryPreparation | undefined,
        retrievalHint: string | undefined;
      if (priorHint) {
        const historyEnd = Math.min(ingressDeadline, principalEnd);
        history = await withinResearchDeadline(
          originalSignal,
          async (signal) => {
            const assert = () => {
              signal.throwIfAborted();
              if (performance.now() >= historyEnd)
                throw Error(RESEARCH_HTTP_ERROR);
            };
            assert();
            const current = inspectPreparedResearchCatalogView(
              prepareResearchCatalogView(
                catalog,
                principal.subject,
                Math.min(target.scope.expiresAtMs, principal.expires_at_ms),
              ),
            ).context;
            // A saved quote is private source-derived data. Fence both processing
            // destinations for the NEW signed subject/full influence union first.
            for (const profile of [
              RESEARCH_LOCAL_RETRIEVAL_PROFILE,
              RESEARCH_PROCESSOR_PROFILE,
            ])
              await requireResearchSourceAccess(
                current,
                { kind: "generation", processor_profile: profile },
                sourceReaders(headers),
                signal,
                historyEnd,
              );
            const candidate = await createSqlResearchAdmission(
              database,
              target.scope,
              target.storage,
            ).readOwnedCompletedHistoryCandidate(
              priorHint.permit_id,
              principal.subject.user_id,
              signal,
              historyEnd,
            );
            assert();
            if (!candidate) throw new HttpFault(409);
            if (candidate.answer_id !== priorHint.expected_answer_id)
              fault(409);
            // Deterministic local context only: no paid rewriting and no silent
            // truncation/global fallback. The original current question is kept.
            retrievalHint = parseResearchQuestion({
              question: candidate.question + "\n\n" + body.question,
              mode: "passage",
            }).question;
            assert();
            return { candidate, scope: target.scope };
          },
          historyEnd,
        );
      }
      const query = await retrieveResearchQuery(
          {
            catalog,
            subject: principal.subject,
            expiresAtMs: Math.min(
              target.scope.expiresAtMs,
              principal.expires_at_ms,
            ),
            request: {
              ...retrievalRequest,
              ...(retrievalHint === undefined
                ? {}
                : { retrieval_query: retrievalHint }),
            },
            createSourceReaders: () => sourceReaders(headers),
            search,
            materialize,
          },
          originalSignal,
        ),
        input = inspectResearchQuery(query),
        answerId = createUuidV7();
      if (input.outcome !== "ready") {
        const outcome = Object.freeze({ service, query }),
          outcomeKind = input.outcome,
          deadline = performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
        return await withinResearchDeadline(
          originalSignal,
          async (signal) => {
            const result: unknown = await adoption.requireOutcomeActive(
              outcome,
              signal,
            );
            if (result !== undefined) throw Error(RESEARCH_HTTP_ERROR);
            return withResearchSourceDelivery(
              input.context,
              sourceReaders(headers, true),
              signal,
              () => {
                signal.throwIfAborted();
                unreturnedResponse = createResearchAnswerResponse(
                  researchQueryOutcomeAnswer(answerId, outcomeKind),
                );
                const ready: unknown = adoption.assertOutcomeReady(
                  outcome,
                  signal,
                );
                if (ready !== undefined) {
                  void Promise.resolve(ready).catch(() => {});
                  throw Error(RESEARCH_HTTP_ERROR);
                }
                signal.throwIfAborted();
                return unreturnedResponse;
              },
              deadline,
            );
          },
          deadline,
        );
      }
      const preparationEnd = performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
      const job = await withinResearchDeadline(
        originalSignal,
        async (prepareSignal) => {
          // Validate the entire body/private packet, including optional quoted
          // history, before resolving any credential or observing a price.
          const artifact = prepareResearchRequestArtifact(
            freezeResearchModelRequest(query, answerId, history),
            target.scope.windowId,
            createUuidV7(),
          );
          prepareSignal.throwIfAborted();
          if (performance.now() >= preparationEnd)
            throw Error(RESEARCH_HTTP_ERROR);
          const key: unknown = typeof apiKey === "function" ? apiKey() : apiKey;
          // Reject an accidental async resolver without leaving private diagnostics unhandled, even if it also aborts the request.
          if (key instanceof Promise) void key.catch(() => {});
          prepareSignal.throwIfAborted();
          if (
            performance.now() >= preparationEnd ||
            typeof key !== "string" ||
            key.trim() !== key ||
            !/^[\x21-\x7e]{16,2048}$/.test(key)
          ) {
            throw Error(RESEARCH_HTTP_ERROR);
          }
          const quoteTarget = {
            database,
            scope: target.scope,
            storage: target.storage,
          };
          const observation = await createResearchPriceObserver({
              requestFetch: priceFetch,
            })(prepareSignal),
            clock = await observeResearchQuoteClock(database, prepareSignal),
            quote = createResearchQuotePort(
              prepareResearchQuote(artifact, observation, clock, quoteTarget),
              artifact,
              quoteTarget,
            );
          const sources = createResearchGenerationSourcePorts({
            database,
            authOptions: settings,
            requestHeaders: headers,
            sourceStorage,
            maintenance,
          });
          const jobPorts = await adoption.createJobPorts(
            Object.freeze({
              service,
              artifact,
              quote: quote.quote,
              ...quoteTarget,
            }),
            prepareSignal,
          );
          const requireJobActive = jobPorts.requireActive,
            assertJobReady = jobPorts.assertHandoffReady;
          if (
            typeof requireJobActive !== "function" ||
            typeof assertJobReady !== "function"
          )
            throw Error(RESEARCH_HTTP_ERROR);
          return createResearchAnswerJob({
            artifact,
            quote: quote.quote,
            database,
            scope: target.scope,
            storage: target.storage,
            apiKey: key,
            requireActive: async (stage, s) => {
              const result: unknown = await requireJobActive(stage, s);
              if (result !== undefined) throw Error(RESEARCH_HTTP_ERROR);
            },
            requireFreshQuote: quote.requireFreshQuote,
            createSourceReaders: sources.createSourceReaders,
            requestFetch,
            assertHandoffReady: (stage, signal) => {
              if (stage === "dispatch") quote.assertDispatchQuoteReady(signal);
              return assertJobReady(stage, signal);
            },
          });
        },
        preparationEnd,
      );
      await job.execute(originalSignal);
      return await job.createAnswerResponse(originalSignal);
    } catch (error) {
      try {
        if (unreturnedResponse?.body && !unreturnedResponse.body.locked)
          void unreturnedResponse.body.cancel().catch(() => {});
      } catch {}
      return failure(
        error instanceof HttpFault ? error.status : 503,
        ownedBody,
      );
    } finally {
      if (ownedSlot) inFlight = false;
    }
  };
}
