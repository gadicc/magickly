/** Inactive single-turn job coordination. No environment reader, activation writer, route or fallback. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { createResearchAnswerResponse } from "./answerResponse";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline as within,
} from "./boundedWork";
import { createResearchGatewayCapture } from "./gatewayCapture";
import {
  inspectResearchRequestArtifact,
  type PreparedResearchRequestArtifact,
} from "./requestArtifact";
import { prepareResearchResult } from "./resultArtifact";
import {
  prepareResearchSourceHandoff,
  type ResearchSourceReaders,
  type ResearchSourceUse,
  requireResearchSourceAccess,
  withResearchSourceDelivery,
} from "./sourceAuthorization";
import {
  createSqlResearchAdmission,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
  type ResearchAdmissionDatabase,
  type ResearchDispatchClaim,
  type ResearchPermitStatus,
} from "./sqlAdmission";

export const RESEARCH_JOB_ERROR = "Private research job unavailable";
export const RESEARCH_JOB_GATE_TIMEOUT_MS = RESEARCH_OPERATION_TIMEOUT_MS;
const fail = (): never => {
  throw Error(RESEARCH_JOB_ERROR);
};
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const quoteShape = v.strictObject({
  request_artifact_sha256: hash,
  upperPico: v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(1),
    v.maxValue(350000000000),
  ),
  quoteExpiresAtMs: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
});
/** Exact server-prepared quote binding. This shape is not pricing, adoption or a user capability. */
export type ResearchJobQuote = Readonly<v.InferOutput<typeof quoteShape>>;
/** Actual immutable job inputs sent to the price port; never substitute a captured/caller target for these bindings. */
export interface ResearchJobPriceBinding {
  readonly artifact: PreparedResearchRequestArtifact;
  readonly quote: ResearchJobQuote;
  readonly database: ResearchAdmissionDatabase;
  readonly scope: ResearchAccountingScope;
  readonly storage: ResearchAccountingStorage;
}
/** Trusted per-job startup ports. No callback is an authorization token; their real implementations remain release gates. */
export interface ResearchAnswerJobOptions {
  artifact: PreparedResearchRequestArtifact;
  quote: ResearchJobQuote;
  database: ResearchAdmissionDatabase;
  scope: ResearchAccountingScope;
  storage?: ResearchAccountingStorage;
  apiKey: string;
  /** Check reviewed adoption, authoritative budget namespace, operator audience, code/body/profile and lifetime. No provider work. */
  requireActive(
    stage: "prepare" | "dispatch" | "delivery",
    signal: AbortSignal,
  ): Promise<void>;
  /** Fresh public price/body/quote validity before both reservation and the one handoff; never sends private text. */
  requireFreshQuote(
    stage: "prepare" | "dispatch",
    binding: ResearchJobPriceBinding,
    signal: AbortSignal,
  ): Promise<void>;
  /** Synchronous final activation/code/quote-lease check after source access, immediately before each handoff. Never return a Promise. */
  assertHandoffReady(
    stage: "dispatch" | "delivery",
    signal: AbortSignal,
  ): undefined;
  /** New uncached readers for the original signed request headers at every gate. Never return a cached grant. */
  createSourceReaders(
    stage: "prepare" | "dispatch" | "delivery",
    binding: ResearchJobPriceBinding,
  ): ResearchSourceReaders;
  /** Trusted test/server fetch only; no caller-selected endpoint or provider. */
  requestFetch?: typeof fetch;
}
const active = () => new AbortController().signal;
/**
 * One server-owned prepared operation. execute() owns the original cancellation and cannot be restarted.
 * Delivery re-reads durable completion and fresh access, then creates a complete SDK response synchronously.
 * The caller must return that response immediately; it is not a cache/history permission.
 */
export function createResearchAnswerJob(options: ResearchAnswerJobOptions) {
  try {
    const artifact = options.artifact,
      prepared = inspectResearchRequestArtifact(artifact),
      packet = prepared.packet;
    const quote = Object.freeze(v.parse(quoteShape, options.quote));
    const requireActive = options.requireActive,
      requireFreshQuote = options.requireFreshQuote,
      createSourceReaders = options.createSourceReaders,
      assertHandoffReady = options.assertHandoffReady;
    if (
      quote.request_artifact_sha256 !== prepared.packet_sha256 ||
      typeof requireActive !== "function" ||
      typeof requireFreshQuote !== "function" ||
      typeof createSourceReaders !== "function" ||
      typeof assertHandoffReady !== "function"
    )
      fail();
    const database = options.database,
      scope = Object.freeze(structuredClone(options.scope)),
      storage = Object.freeze(structuredClone(options.storage ?? {}));
    const store = createSqlResearchAdmission(database, scope, storage);
    const priceBinding: ResearchJobPriceBinding = Object.freeze({
      artifact,
      quote,
      database,
      scope,
      storage,
    });
    const source = async (
      stage: "prepare" | "dispatch" | "delivery",
      use: ResearchSourceUse,
      signal: AbortSignal,
    ) => {
      // Include synchronous factory work in the outer deadline; it must not start a fresh lifetime after blocking.
      await within(signal, (s) =>
        requireResearchSourceAccess(
          packet.context,
          use,
          createSourceReaders(stage, priceBinding),
          s,
        ),
      );
    };
    const generation = {
      kind: "generation" as const,
      processor_profile: packet.processor_profile,
    };
    let dispatchFreshness: (() => undefined) | undefined;
    const capture = createResearchGatewayCapture({
      apiKey: options.apiKey,
      handoff: store,
      requestFetch: options.requestFetch,
      beforeHandoff: (_received, _claim, signal) =>
        assertHandoffReady("dispatch", signal),
      beforeRequest: (received, _claim, signal) => {
        const check = dispatchFreshness;
        if (received !== artifact || !check) return fail();
        signal.throwIfAborted();
        dispatchFreshness = undefined;
        return check();
      },
      beforeDispatch: async (received, _claim, signal) => {
        if (received !== artifact) fail();
        await within(signal, (s) => requireActive("dispatch", s));
        await within(signal, (s) =>
          requireFreshQuote("dispatch", priceBinding, s),
        );
        // Final awaited decision is the fresh session/source fence. Capture consumes the real claim synchronously afterwards.
        const sourceDeadline = performance.now() + RESEARCH_JOB_GATE_TIMEOUT_MS;
        dispatchFreshness = await within(
          signal,
          (s) =>
            prepareResearchSourceHandoff(
              packet.context,
              generation,
              createSourceReaders("dispatch", priceBinding),
              s,
              sourceDeadline,
            ),
          sourceDeadline,
        );
      },
    });
    let execution: Promise<ResearchPermitStatus> | undefined,
      originalSignal: AbortSignal | undefined,
      settled = false,
      permitId: string | undefined;
    async function run(signal: AbortSignal): Promise<ResearchPermitStatus> {
      let claim: ResearchDispatchClaim | undefined;
      try {
        await within(signal, (s) => requireActive("prepare", s));
        await within(signal, (s) =>
          requireFreshQuote("prepare", priceBinding, s),
        );
        await source("prepare", generation, signal);
        const receipt = await within(signal, (s) =>
          store.reserveWithRequest(
            artifact,
            {
              upperPico: quote.upperPico,
              quoteExpiresAtMs: quote.quoteExpiresAtMs,
            },
            s,
          ),
        );
        permitId = receipt.permitId;
        if (receipt.state !== "reserved") return receipt;
        claim =
          (await within(signal, (s) =>
            store.beginDispatchWithRequest(receipt.permitId, artifact, s),
          )) ?? undefined;
        if (!claim)
          return await within(signal, (s) =>
            store.inspect(
              receipt.permitId,
              packet.context.subject.user_id,
              packet.context.subject.session_id,
              s,
            ),
          );
        const bytes = await capture(artifact, claim, signal),
          result = prepareResearchResult(bytes, artifact, claim);
        // Billing/result settlement is independent of client cancellation, source revocation and activation.
        return await within(active(), (s) =>
          store.finishWithResult(claim!, artifact, result, s),
        );
      } catch {
        if (claim) {
          try {
            return await within(active(), (s) =>
              store.finish(
                claim!,
                {
                  outcome: "indeterminate",
                  reportedPico: null,
                  responseSha256: null,
                },
                s,
              ),
            );
          } catch {}
        }
        return fail();
      } finally {
        settled = true;
      }
    }
    return Object.freeze({
      /** Same original signal reuses one execution promise; another signal can never revive or restart this job. Metadata only. */
      async execute(signal: AbortSignal): Promise<ResearchPermitStatus> {
        try {
          if (execution) {
            if (originalSignal !== signal) fail();
            return structuredClone(await execution);
          }
          originalSignal = signal;
          execution = run(signal);
          void execution.catch(() => {});
          return structuredClone(await execution);
        } catch {
          return fail();
        }
      },
      /** No model work begins here. Wait for execute() to settle before requesting a response; no SSE bytes are returned early. */
      async createAnswerResponse(signal: AbortSignal): Promise<Response> {
        let response: Response | undefined;
        try {
          signal.throwIfAborted();
          if (!settled || !permitId) fail();
          const candidateEnd =
            performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
          const candidate = await within(
            signal,
            (s) =>
              store.readCompletedAnswerCandidate(
                permitId!,
                packet.context.subject.user_id,
                packet.context.subject.session_id,
                s,
                candidateEnd,
              ),
            candidateEnd,
          );
          if (!candidate) return fail();
          if (
            candidate.request_revision !== packet.request_revision ||
            candidate.query_revision !== packet.query_revision ||
            candidate.answer.answer_id !== packet.answer_id ||
            createHash("sha256")
              .update(JSON.stringify(candidate.context))
              .digest("hex") !== packet.source_context_sha256
          )
            fail();
          await within(signal, (s) => requireActive("delivery", s));
          const sourceDeadline =
            performance.now() + RESEARCH_JOB_GATE_TIMEOUT_MS;
          return await within(
            signal,
            (s) =>
              withResearchSourceDelivery(
                packet.context,
                createSourceReaders("delivery", priceBinding),
                s,
                () => {
                  s.throwIfAborted();
                  if (performance.now() >= candidate.retention_deadline) fail();
                  response = createResearchAnswerResponse(candidate.answer);
                  const readiness: unknown = assertHandoffReady("delivery", s);
                  if (readiness !== undefined) {
                    void Promise.resolve(readiness).catch(() => {});
                    fail();
                  }
                  s.throwIfAborted();
                  if (performance.now() >= candidate.retention_deadline) {
                    try {
                      void response.body?.cancel().catch(() => {});
                    } catch {}
                    fail();
                  }
                  return response;
                },
                sourceDeadline,
              ),
            sourceDeadline,
          );
        } catch {
          try {
            if (response?.body && !response.body.locked)
              void response.body.cancel().catch(() => {});
          } catch {}
          return fail();
        }
      },
    });
  } catch {
    return fail();
  }
}
