/** Inactive private research source gate. No runtime singleton, provider, route or policy writer. */
import "server-only";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";

export const RESEARCH_SOURCE_ERROR = "Private research source unavailable";
/** Bounds waiting and rejects late results, including delayed timers; cannot preempt blocking I/O/CPU. */
export const RESEARCH_SOURCE_TIMEOUT_MS = 8000;
const exact = (pattern: RegExp) => (value: string) =>
  pattern.exec(value)?.[0] === value;
const key = v.pipe(v.string(), v.check(exact(/^[a-zA-Z0-9_-]{1,128}$/)));
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const revision = v.pipe(
  v.string(),
  v.maxLength(20),
  v.check(exact(/^(0|[1-9][0-9]{0,19})$/)),
);
const timestamp = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const refId = v.pipe(v.string(), v.check(exact(/^ref([1-9][0-9]?|100)$/)));
const subjectSchema = v.strictObject({
  kind: v.literal("user"),
  user_id: uuid,
  session_id: uuid,
});
const principalSchema = v.strictObject({
  subject: subjectSchema,
  /** Private digest of the verified session token + identity, never a client capability. */
  session_binding_sha256: hash,
  expires_at_ms: timestamp,
});
const bindingSchema = v.strictObject({
  reference_id: refId,
  source_id: key,
  source_version: hash,
  evidence_version: hash,
});
const contextSchema = v.strictObject({
  subject: subjectSchema,
  corpus_version: hash,
  expires_at_ms: timestamp,
  bindings: v.pipe(v.array(bindingSchema), v.minLength(1), v.maxLength(100)),
  visible_reference_ids: v.pipe(v.array(refId), v.maxLength(4)),
});
const capabilitiesSchema = v.strictObject({
  generation: v.optional(v.boolean(), false),
  answer: v.optional(v.boolean(), false),
  metadata: v.optional(v.boolean(), false),
  excerpt: v.optional(v.literal(false), false),
  image: v.optional(v.literal(false), false),
  download: v.optional(v.literal(false), false),
  processor_profiles: v.optional(v.pipe(v.array(key), v.maxLength(20)), []),
});
const snapshotSchema = v.strictObject({
  subject: subjectSchema,
  corpus_version: hash,
  authorization_version: revision,
  publication_state: v.picklist(["published", "draft", "revoked"]),
  sources: v.pipe(
    v.array(
      v.strictObject({
        binding: bindingSchema,
        state: v.picklist(["active", "revoked"]),
        valid_from_ms: v.nullable(timestamp),
        valid_until_ms: v.nullable(timestamp),
        rights: capabilitiesSchema,
        grants: capabilitiesSchema,
      }),
    ),
    v.minLength(1),
    v.maxLength(100),
  ),
});
const useSchema = v.variant("kind", [
  v.strictObject({ kind: v.literal("generation"), processor_profile: key }),
  v.strictObject({ kind: v.literal("delivery") }),
]);
/** Server-owned canonical identity. Anonymous research access is unsupported. */
export type ResearchSourceSubject = v.InferOutput<typeof subjectSchema>;
/** Exact source and evidence revisions; never supplied as authority by a browser. */
export type ResearchEvidenceBinding = v.InferOutput<typeof bindingSchema>;
/** Server-owned request/answer context; bindings include every influencing source. */
export type ResearchSourceContext = v.InferOutput<typeof contextSchema>;
export type ResearchSourceUse = v.InferOutput<typeof useSchema>;
export type ResearchSourceSnapshot = v.InferOutput<typeof snapshotSchema>;
/** Adapters must be uncached, fail closed and read the actual signed-in session plus current policy. */
export interface ResearchSourceReaders {
  readPrincipal(signal: AbortSignal): Promise<unknown>;
  /** One consistent database snapshot, including the authorization revision. */
  loadSnapshot(
    subject: ResearchSourceSubject,
    context: ResearchSourceContext,
    signal: AbortSignal,
  ): Promise<unknown>;
  /** One committed, uncached session-token/owner/expiry + policy revision fence. Reject snapshot/repeatable-read outer transactions. Every relevant policy mutation must advance a non-resetting revision. */
  readFence(
    subject: ResearchSourceSubject,
    corpusVersion: string,
    signal: AbortSignal,
  ): Promise<unknown>;
  now(): number;
}
const sameSubject = (a: ResearchSourceSubject, b: ResearchSourceSubject) =>
  a.user_id === b.user_id && a.session_id === b.session_id;
const sameBinding = (a: ResearchEvidenceBinding, b: ResearchEvidenceBinding) =>
  a.reference_id === b.reference_id &&
  a.source_id === b.source_id &&
  a.source_version === b.source_version &&
  a.evidence_version === b.evidence_version;
const check = (ok: unknown) => {
  if (!ok) throw Error(RESEARCH_SOURCE_ERROR);
};
const alive = (principal: v.InferOutput<typeof principalSchema>, now: number) =>
  principal.expires_at_ms > now;

/** Owned context-format validation only; never identity, permission or a renewed processing lifetime. */
export function parseResearchSourceContext(
  value: unknown,
): ResearchSourceContext {
  try {
    const raw = value as Partial<ResearchSourceContext> | null;
    check(
      raw &&
        Array.isArray(raw.bindings) &&
        raw.bindings.length >= 1 &&
        raw.bindings.length <= 100,
    );
    check(
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 64 * 1024,
    );
    const c = v.parse(contextSchema, value);
    check(
      new Set(c.bindings.map((b) => b.reference_id)).size === c.bindings.length,
    );
    check(
      new Set(c.visible_reference_ids).size ===
        c.visible_reference_ids.length &&
        c.visible_reference_ids.every((id) =>
          c.bindings.some((b) => b.reference_id === id),
        ),
    );
    return c;
  } catch {
    throw Error(RESEARCH_SOURCE_ERROR);
  }
}

/**
 * Re-read identity around a consistent policy snapshot, then fence its revision.
 * Returns no reusable grant/token. Use immediately at each processor dispatch
 * and final delivery. Excerpts, images and downloads remain unsupported.
 * The last fence is the decision point;
 * later revocations cannot retract bytes already delivered or in flight.
 * Contexts and their complete influence union must be prepared by trusted server
 * code, never accepted as access authority from a client. This gate does not
 * approve hosted recipients, budgets, retention or provider activation.
 */
export async function requireResearchSourceAccess(
  context: ResearchSourceContext,
  use: ResearchSourceUse,
  readers: ResearchSourceReaders,
  signal: AbortSignal,
  absoluteDeadlineAt?: number,
): Promise<void> {
  await sourceAccess(
    context,
    use,
    readers,
    signal,
    undefined,
    false,
    absoluteDeadlineAt,
  );
}
/** One-attempt freshness tail only, not a dispatch/source grant. The owning job must bind and consume it at its actual synchronous fetch handoff. An inherited monotonic deadline can only shorten the eight-second lifetime. */
export async function prepareResearchSourceHandoff(
  context: ResearchSourceContext,
  use: Extract<ResearchSourceUse, { kind: "generation" }>,
  readers: ResearchSourceReaders,
  signal: AbortSignal,
  absoluteDeadlineAt?: number,
): Promise<() => undefined> {
  try {
    const result = await sourceAccess(
      context,
      use,
      readers,
      signal,
      undefined,
      true,
      absoluteDeadlineAt,
    );
    if (typeof result !== "function") throw Error(RESEARCH_SOURCE_ERROR);
    return result;
  } catch {
    throw Error(RESEARCH_SOURCE_ERROR);
  }
}
/** Data validation only, never proof of signed authentication, source permission or read adoption. Private session binding stays server-side. */
export function parseResearchSourcePrincipal(value: unknown) {
  try {
    return v.parse(principalSchema, value);
  } catch {
    throw Error(RESEARCH_SOURCE_ERROR);
  }
}
/**
 * Source-only delivery gate plus a synchronous Response projection, with authority expiry checked after projection.
 * The caller must independently prove retained completion and adopted read scope. No reusable grant is returned.
 * Projection must not perform provider/database work or async effects; an unreturned response cannot be streamed early.
 */
export async function withResearchSourceDelivery(
  context: ResearchSourceContext,
  readers: ResearchSourceReaders,
  signal: AbortSignal,
  project: () => Response,
  absoluteDeadlineAt?: number,
): Promise<Response> {
  try {
    if (typeof project !== "function") throw Error(RESEARCH_SOURCE_ERROR);
    const response = await sourceAccess(
      context,
      { kind: "delivery" },
      readers,
      signal,
      project,
      false,
      absoluteDeadlineAt,
    );
    if (!(response instanceof Response)) throw Error(RESEARCH_SOURCE_ERROR);
    return response;
  } catch {
    throw Error(RESEARCH_SOURCE_ERROR);
  }
}
async function sourceAccess(
  context: ResearchSourceContext,
  use: ResearchSourceUse,
  readers: ResearchSourceReaders,
  signal: AbortSignal,
  project?: () => Response,
  prepareHandoff = false,
  absoluteDeadlineAt?: number,
): Promise<Response | (() => undefined) | void> {
  if (
    absoluteDeadlineAt !== undefined &&
    (typeof absoluteDeadlineAt !== "number" ||
      !Number.isFinite(absoluteDeadlineAt))
  )
    throw Error(RESEARCH_SOURCE_ERROR);
  const started = performance.now(),
    deadlineAt = Math.min(
      started + RESEARCH_SOURCE_TIMEOUT_MS,
      absoluteDeadlineAt ?? Infinity,
    ),
    deadline = new AbortController(),
    timeout = setTimeout(
      () => deadline.abort(),
      Math.max(0, deadlineAt - started),
    ),
    checkSignal = AbortSignal.any([signal, deadline.signal]);
  let onAbort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(Error(RESEARCH_SOURCE_ERROR));
  });
  checkSignal.addEventListener("abort", onAbort, { once: true });
  // A synchronous deadline check can abort before the first race is installed.
  void interrupted.catch(() => {});
  const assertLive = (at = performance.now()) => {
    checkSignal.throwIfAborted();
    if (!(at < deadlineAt)) {
      deadline.abort();
      throw Error(RESEARCH_SOURCE_ERROR);
    }
  };
  const wait = async <T>(work: () => Promise<T>): Promise<T> => {
    assertLive();
    const result = await Promise.race([
      Promise.resolve().then(() => {
        assertLive();
        return work();
      }),
      interrupted,
    ]);
    assertLive();
    return result;
  };
  let projectedResponse: Response | undefined;
  try {
    const c = parseResearchSourceContext(context),
      action = v.parse(useSchema, use);
    if (prepareHandoff && action.kind !== "generation")
      throw Error(RESEARCH_SOURCE_ERROR);
    assertLive();
    const first = v.parse(
      principalSchema,
      await wait(() => readers.readPrincipal(checkSignal)),
    );
    check(sameSubject(first.subject, c.subject) && alive(first, readers.now()));
    assertLive();
    const rawSnapshot = await wait(() =>
      readers.loadSnapshot(
        structuredClone(first.subject),
        structuredClone(c),
        checkSignal,
      ),
    );
    check(
      rawSnapshot &&
        typeof rawSnapshot === "object" &&
        "sources" in rawSnapshot &&
        Array.isArray(rawSnapshot.sources) &&
        rawSnapshot.sources.length >= 1 &&
        rawSnapshot.sources.length <= 100,
    );
    const snapshot = v.parse(snapshotSchema, rawSnapshot);
    assertLive();
    const fenceStarted = performance.now();
    const fence = v.parse(
      v.strictObject({
        principal: principalSchema,
        authorization_version: revision,
      }),
      await wait(() =>
        readers.readFence(
          structuredClone(first.subject),
          c.corpus_version,
          checkSignal,
        ),
      ),
    );
    const last = fence.principal,
      currentRevision = fence.authorization_version;
    assertLive();
    // The database clock may have been sampled before its COMMIT acknowledgement.
    // Add the entire final wait conservatively; never extend session/context/window/source lifetimes.
    const observedNow = v.parse(timestamp, readers.now());
    const now = v.parse(
      timestamp,
      observedNow + Math.ceil(performance.now() - fenceStarted),
    );
    check(
      sameSubject(first.subject, last.subject) &&
        first.session_binding_sha256 === last.session_binding_sha256 &&
        sameSubject(last.subject, c.subject) &&
        alive(last, now) &&
        c.expires_at_ms > now,
    );
    check(
      snapshot.publication_state === "published" &&
        snapshot.corpus_version === c.corpus_version &&
        sameSubject(snapshot.subject, c.subject) &&
        currentRevision === snapshot.authorization_version,
    );
    check(
      snapshot.sources.length === c.bindings.length &&
        new Set(snapshot.sources.map((s) => s.binding.reference_id)).size ===
          c.bindings.length,
    );
    for (const b of c.bindings) {
      const s = snapshot.sources.find(
        (s) => s.binding.reference_id === b.reference_id,
      );
      check(s && sameBinding(s.binding, b));
    }
    for (const s of snapshot.sources) {
      check(
        s.state === "active" &&
          (s.valid_from_ms === null || s.valid_from_ms <= observedNow) &&
          (s.valid_until_ms === null || s.valid_until_ms > now),
      );
      const required =
        action.kind === "generation"
          ? (["generation", "answer", "metadata"] as const)
          : (["answer", "metadata"] as const);
      for (const capability of required)
        check(s.rights[capability] === true && s.grants[capability] === true);
      if (action.kind === "generation")
        check(
          s.rights.processor_profiles.includes(action.processor_profile) &&
            s.grants.processor_profiles.includes(action.processor_profile),
        );
    }
    // Fence completion/COMMIT and synchronous validation can consume a shorter authority lifetime.
    // Make this final monotonic read the success decision; never renew an expiry with the work timeout.
    const expiresAt = Math.min(
      last.expires_at_ms,
      c.expires_at_ms,
      ...snapshot.sources.map((s) => s.valid_until_ms ?? Infinity),
    );
    if (project) {
      const result: unknown = project();
      if (!(result instanceof Response)) {
        void Promise.resolve(result).catch(() => {});
        throw Error(RESEARCH_SOURCE_ERROR);
      }
      if (result.bodyUsed || result.body?.locked)
        throw Error(RESEARCH_SOURCE_ERROR);
      projectedResponse = result;
      // Async returns assimilate callable then properties after our final check.
      // Refuse supplied then members without invoking them, and prevent later injection.
      if ("then" in result) throw Error(RESEARCH_SOURCE_ERROR);
      Object.defineProperty(result, "then", {
        value: undefined,
        writable: false,
        configurable: false,
        enumerable: false,
      });
    }
    const completeAt = performance.now();
    assertLive(completeAt);
    check(observedNow + Math.ceil(completeAt - fenceStarted) < expiresAt);
    if (prepareHandoff) {
      let consumed = false;
      const assertFresh = () => {
        if (consumed) throw Error(RESEARCH_SOURCE_ERROR);
        consumed = true;
        const at = performance.now();
        assertLive(at);
        check(observedNow + Math.ceil(at - fenceStarted) < expiresAt);
        return undefined;
      };
      Object.defineProperty(assertFresh, "then", {
        value: undefined,
        writable: false,
        configurable: false,
      });
      return Object.freeze(assertFresh);
    }
    return projectedResponse;
  } catch {
    try {
      if (projectedResponse?.body && !projectedResponse.body.locked)
        void projectedResponse.body.cancel().catch(() => {});
    } catch {}
    throw Error(RESEARCH_SOURCE_ERROR);
  } finally {
    clearTimeout(timeout);
    checkSignal.removeEventListener("abort", onAbort);
  }
}
