/** Inactive retained-answer delivery for a freshly authenticated canonical owner. No generation, history, key or adoption writer. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import {
  parseResearchAccountingTarget,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
} from "./accountingScope";
import { createResearchAnswerResponse } from "./answerResponse";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  parseResearchSourceContext,
  parseResearchSourcePrincipal,
  type ResearchSourceSubject,
  withResearchSourceDelivery,
} from "./sourceAuthorization";
import {
  createSqlResearchAdmission,
  type ResearchAdmissionDatabase,
} from "./sqlAdmission";
import {
  copyResearchSourceAuthOptions,
  createSqlResearchSourceReaders,
  parseResearchSourceStorage,
  type ResearchSourceAuthOptions,
  type ResearchSourceStorage,
} from "./sqlSourceReaders";
export const RESEARCH_RETAINED_DELIVERY_ERROR =
  "Private retained answer unavailable";
function fail(): never {
  throw Error(RESEARCH_RETAINED_DELIVERY_ERROR);
}
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const timestamp = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
/** Actual immutable read inputs supplied to the required adoption ports. Neither these fields nor a callback approve a read scope. */
export interface ResearchRetainedReadBinding {
  readonly database: ResearchAdmissionDatabase;
  readonly scope: ResearchAccountingScope;
  readonly storage: ResearchAccountingStorage;
  readonly source_storage: ResearchSourceStorage;
  readonly permit_id: string;
  /** Absolute adopted read deadline; never calculated as now+duration on login/restart. */
  readonly read_until_ms: number;
  readonly current_subject: ResearchSourceSubject;
  /** Canonical original processing facts only. Strings cannot be mutated into another source union by a port. No passages, request body, draft or raw response. */
  readonly completed: Readonly<{
    answer_id: string;
    answer_sha256: string;
    response_artifact_sha256: string;
    request_revision: string;
    query_revision: string;
    original_source_context_json: string;
    original_source_context_sha256: string;
    retain_until_ms: number;
  }> | null;
}
/** Trusted inactive server configuration. Real reviewed read adoption and bounded final revocation/lease remain required before wiring a live caller. */
export interface ResearchRetainedDeliveryOptions {
  readonly database: ResearchAdmissionDatabase;
  readonly scope: ResearchAccountingScope;
  readonly storage?: ResearchAccountingStorage;
  readonly sourceStorage: ResearchSourceStorage;
  readonly authOptions: ResearchSourceAuthOptions;
  readonly readUntilMs: number;
  /** Bind actual DB/namespace, original approval/window/corpus, canonical actor, permitted retained scope and absolute read expiry. No provider or packet mutation. */
  readonly requireReadActive: (
    stage: "prepare" | "delivery",
    binding: ResearchRetainedReadBinding,
    signal: AbortSignal,
    /** Original whole-read monotonic bound; trusted composition may only shorten it. */
    deadlineAt?: number,
  ) => Promise<void>;
  /** Synchronous adopted read-lease/code check after the final SQL source fence. Must not return a Promise. It alone is not an atomic multi-authority grant. */
  readonly assertReadReady: (
    binding: ResearchRetainedReadBinding,
    signal: AbortSignal,
  ) => undefined;
}
/**
 * Builds actual uncached signed-cookie SQL readers and the closed immutable result reader over one trusted root.
 * Each call owns NEW incoming headers; relogin changes only a private delivery context, never stored processing facts.
 * A stopped/expired spending window cannot authorize new work through this read-only API.
 */
export function createSqlResearchRetainedDelivery(
  options: ResearchRetainedDeliveryOptions,
) {
  try {
    const database = options.database,
      target = parseResearchAccountingTarget(options.scope, options.storage),
      sourceStorage = parseResearchSourceStorage(options.sourceStorage),
      authOptions = copyResearchSourceAuthOptions(options.authOptions),
      readUntilMs = v.parse(timestamp, options.readUntilMs),
      requireReadActive = options.requireReadActive,
      assertReadReady = options.assertReadReady;
    if (
      sourceStorage.corpusVersion !== target.scope.corpusVersion ||
      typeof requireReadActive !== "function" ||
      typeof assertReadReady !== "function"
    )
      fail();
    const store = createSqlResearchAdmission(
      database,
      target.scope,
      target.storage,
    );
    // Inert constructor validation only; no auth or database work until an explicit read.
    createSqlResearchSourceReaders(
      database,
      authOptions,
      new Headers(),
      sourceStorage,
    );
    return Object.freeze({
      /** Returns only a current-authorized finished SDK answer. No retry, generation or history token is returned. */
      async createResponse(
        permitId: string,
        incomingHeaders: Headers,
        signal: AbortSignal,
        inheritedDeadlineAt?: number,
      ): Promise<Response> {
        const started = performance.now(),
          cancel = new AbortController(),
          bootstrapCancel = new AbortController();
        let response: Response | undefined;
        try {
          signal.throwIfAborted();
          if (
            inheritedDeadlineAt !== undefined &&
            !Number.isFinite(inheritedDeadlineAt)
          )
            fail();
          let end = Math.min(
            started + RESEARCH_OPERATION_TIMEOUT_MS,
            inheritedDeadlineAt ?? Infinity,
          );
          const id = v.parse(uuid, permitId),
            headers = new Headers(incomingHeaders);
          return await withinResearchDeadline(
            signal,
            async (bounded) => {
              const combined = AbortSignal.any([bounded, cancel.signal]);
              const assert = () => {
                if (combined.aborted || performance.now() >= end) {
                  cancel.abort();
                  fail();
                }
              };
              assert();
              const bootstrapStarted = performance.now();
              const bootstrap = createSqlResearchSourceReaders(
                  database,
                  authOptions,
                  headers,
                  sourceStorage,
                ),
                bootstrapSignal = AbortSignal.any([
                  combined,
                  bootstrapCancel.signal,
                ]);
              let principal: ReturnType<typeof parseResearchSourcePrincipal>;
              try {
                principal = parseResearchSourcePrincipal(
                  await bootstrap.readPrincipal(bootstrapSignal),
                );
                assert();
                const nativeNow = bootstrap.now();
                if (
                  principal.expires_at_ms <=
                  nativeNow + Math.ceil(performance.now() - bootstrapStarted)
                )
                  fail();
                end = Math.min(
                  end,
                  bootstrapStarted + principal.expires_at_ms - nativeNow,
                );
                assert();
              } finally {
                bootstrapCancel.abort();
              }
              if (principal.subject.user_id !== target.scope.actorId) fail();
              const base = Object.freeze({
                database,
                scope: target.scope,
                storage: target.storage,
                source_storage: sourceStorage,
                permit_id: id,
                read_until_ms: readUntilMs,
                current_subject: Object.freeze({ ...principal.subject }),
              });
              await withinResearchDeadline(
                combined,
                (s) =>
                  requireReadActive(
                    "prepare",
                    Object.freeze({ ...base, completed: null }),
                    s,
                    end,
                  ),
                end,
              );
              assert();
              const candidate = await withinResearchDeadline(
                combined,
                (s) =>
                  store.readOwnedCompletedAnswerCandidate(
                    id,
                    principal.subject.user_id,
                    s,
                    end,
                  ),
                end,
              );
              assert();
              if (
                !candidate ||
                !candidate.answer_sha256 ||
                performance.now() >= candidate.retention_deadline
              )
                fail();
              const originalJson = JSON.stringify(candidate.context);
              const binding: ResearchRetainedReadBinding = Object.freeze({
                ...base,
                completed: Object.freeze({
                  answer_id: candidate.answer.answer_id,
                  answer_sha256: candidate.answer_sha256,
                  response_artifact_sha256: candidate.response_artifact_sha256,
                  request_revision: candidate.request_revision,
                  query_revision: candidate.query_revision,
                  original_source_context_json: originalJson,
                  original_source_context_sha256: createHash("sha256")
                    .update(originalJson)
                    .digest("hex"),
                  retain_until_ms: candidate.retain_until_ms,
                }),
              });
              const deliveryContext = parseResearchSourceContext({
                ...structuredClone(candidate.context),
                subject: { ...principal.subject },
                expires_at_ms: Math.min(
                  readUntilMs,
                  principal.expires_at_ms,
                  candidate.retain_until_ms,
                ),
              });
              await withinResearchDeadline(
                combined,
                (s) => requireReadActive("delivery", binding, s, end),
                end,
              );
              assert();
              // A NEW reader authenticates the same copied incoming cookie again; the bootstrap state is consumed/invalidated.
              const readers = createSqlResearchSourceReaders(
                database,
                authOptions,
                headers,
                sourceStorage,
              );
              return await withResearchSourceDelivery(
                deliveryContext,
                readers,
                combined,
                () => {
                  assert();
                  response = createResearchAnswerResponse(candidate.answer);
                  const ready: unknown = assertReadReady(binding, combined);
                  if (ready !== undefined) {
                    void Promise.resolve(ready).catch(() => {});
                    fail();
                  }
                  assert();
                  if (performance.now() >= candidate.retention_deadline) fail();
                  return response;
                },
                end,
              );
            },
            end,
          );
        } catch {
          try {
            if (response?.body && !response.body.locked)
              void response.body.cancel().catch(() => {});
          } catch {}
          return fail();
        } finally {
          bootstrapCancel.abort();
          cancel.abort();
        }
      },
    });
  } catch {
    return fail();
  }
}
