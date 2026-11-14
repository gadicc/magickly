/** Inactive single-attempt private transport. No singleton, environment reader, activation or completion writer. */
import "server-only";
import { createHash } from "node:crypto";
import { RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT } from "./gatewayResponse";
import {
  inspectResearchRequestArtifact,
  type PreparedResearchRequestArtifact,
} from "./requestArtifact";
import type { ResearchDispatchClaim } from "./sqlAdmission";

export const RESEARCH_GATEWAY_CAPTURE_ERROR =
  "Private research capture unavailable";
export const RESEARCH_GATEWAY_ENDPOINT =
  "https://ai-gateway.vercel.sh/v1/responses";
export const RESEARCH_GATEWAY_TIMEOUT_MS = 180000;
export const RESEARCH_GATEWAY_MAX_CHUNKS = 65536;
/** Trusted real ledger port. Synchronous non-Promise return preserves the final-fence-to-fetch boundary.
 * Returned signal must retain the original dispatch job and the supplied additional cancellation/deadline. */
export interface ResearchGatewayHandoff {
  consumeRequestDispatchClaim(
    claim: ResearchDispatchClaim,
    artifact: PreparedResearchRequestArtifact,
    signal: AbortSignal,
  ): AbortSignal;
}
/** Trusted server fence, never browser code. Fresh auth/source/activation/body/code/price checks must finish here;
 * no provider work or SQL transaction may contain the subsequent fetch. */
export type ResearchGatewayDispatchFence = (
  artifact: PreparedResearchRequestArtifact,
  claim: ResearchDispatchClaim,
  signal: AbortSignal,
) => Promise<void>;
/** Synchronous last lease/code/quote check on the same stack as handoff/fetch. No I/O or Promise return. */
export type ResearchGatewayReadyFence = (
  artifact: PreparedResearchRequestArtifact,
  claim: ResearchDispatchClaim,
  signal: AbortSignal,
) => undefined;
/** Opaque local HTTP capture. Still not a completed permit, delivery grant or history record. */
export interface ResearchGatewayCapture {
  readonly revision: string;
}
export type ResearchGatewayCaptureFailure =
  | "preflight"
  | "handoff"
  | "request"
  | "read"
  | "http"
  | "media_type"
  | "too_large"
  | "cancelled"
  | "deadline"
  | "credential_echo"
  | "body_unavailable";
/** Fixed-stage private diagnostics; never exception text, headers, credentials or a public answer. */
export interface ResearchGatewayCaptureMetadata {
  schema_version: 1;
  transport_profile: "gateway-responses-capture-v1";
  request_artifact_sha256: string;
  attempted: boolean;
  http_status: number | null;
  media_type: "application/json" | null;
  complete: boolean;
  received_bytes: number;
  captured_bytes: number;
  captured_sha256: string;
  failure: ResearchGatewayCaptureFailure | null;
}
const captures = new WeakMap<
  object,
  {
    artifact: PreparedResearchRequestArtifact;
    claim: ResearchDispatchClaim;
    metadata: ResearchGatewayCaptureMetadata;
    raw: Uint8Array;
  }
>();
const startedClaims = new WeakSet<ResearchDispatchClaim>();
function fail(): never {
  throw Error(RESEARCH_GATEWAY_CAPTURE_ERROR);
}
const sha = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
function discardBody(response: Response) {
  try {
    if (response.body && !response.body.locked)
      void response.body.cancel().catch(() => {});
  } catch {}
}
/** Streaming conservative ASCII credential matcher after one layer of JSON escaping. It is not a JSON parser. */
function escapedCredentialScanner(needle: Uint8Array) {
  const prefix = new Uint16Array(needle.length);
  for (let i = 1, j = 0; i < needle.length; i++) {
    while (j && needle[i] !== needle[j]) j = prefix[j - 1];
    if (needle[i] === needle[j]) j++;
    prefix[i] = j;
  }
  let matched = 0,
    escaped = false,
    unicodeLeft = 0,
    unicodeValue = 0,
    found = false;
  function decoded(byte: number) {
    while (matched && needle[matched] !== byte) matched = prefix[matched - 1];
    if (needle[matched] === byte) matched++;
    if (matched === needle.length) {
      found = true;
      matched = prefix[matched - 1];
    }
  }
  return (bytes: Uint8Array): boolean => {
    for (const byte of bytes) {
      if (unicodeLeft) {
        const hex =
          byte >= 48 && byte <= 57
            ? byte - 48
            : byte >= 65 && byte <= 70
              ? byte - 55
              : byte >= 97 && byte <= 102
                ? byte - 87
                : -1;
        if (hex < 0) {
          unicodeLeft = 0;
          decoded(-1);
          if (byte === 92) escaped = true;
          else decoded(byte);
        } else {
          unicodeValue = unicodeValue * 16 + hex;
          if (--unicodeLeft === 0) decoded(unicodeValue);
        }
      } else if (escaped) {
        escaped = false;
        if (byte === 117) {
          unicodeLeft = 4;
          unicodeValue = 0;
        } else
          decoded(
            byte === 98
              ? 8
              : byte === 102
                ? 12
                : byte === 110
                  ? 10
                  : byte === 114
                    ? 13
                    : byte === 116
                      ? 9
                      : byte,
          );
      } else if (byte === 92) escaped = true;
      else decoded(byte);
      if (found) return true;
    }
    return found;
  };
}
/** Owned private bytes only, bound to the exact original objects. No public JSON loader recreates a capture. */
export function inspectResearchGatewayCapture(
  capture: ResearchGatewayCapture,
  artifact: PreparedResearchRequestArtifact,
  claim: ResearchDispatchClaim,
) {
  const s = captures.get(capture);
  if (!s || s.artifact !== artifact || s.claim !== claim) return fail();
  return { metadata: structuredClone(s.metadata), raw: Uint8Array.from(s.raw) };
}
/** Trusted startup ports only. Constructing this factory makes no request and reads no credential/environment.
 * Tests may inject a synthetic fetch; an activation must pin the real trusted fetch and ledger adapters. */
export function createResearchGatewayCapture(config: {
  apiKey: string;
  handoff: ResearchGatewayHandoff;
  beforeDispatch: ResearchGatewayDispatchFence;
  beforeHandoff?: ResearchGatewayReadyFence;
  /** Final one-use source freshness after every readiness/claim callback; immediately before fetch, no async work. */
  beforeRequest?: ResearchGatewayReadyFence;
  requestFetch?: typeof fetch;
}) {
  const { apiKey, handoff, beforeDispatch, beforeHandoff, beforeRequest } =
      config,
    requestFetch =
      config.requestFetch === undefined
        ? globalThis.fetch
        : config.requestFetch;
  if (
    typeof apiKey !== "string" ||
    apiKey.trim() !== apiKey ||
    !/^[\x21-\x7e]{16,2048}$/.test(apiKey) ||
    typeof handoff?.consumeRequestDispatchClaim !== "function" ||
    typeof beforeDispatch !== "function" ||
    (beforeHandoff !== undefined && typeof beforeHandoff !== "function") ||
    (beforeRequest !== undefined && typeof beforeRequest !== "function") ||
    typeof requestFetch !== "function"
  )
    fail();
  const consume = handoff.consumeRequestDispatchClaim.bind(handoff),
    credential = Buffer.from(apiKey);
  return async (
    artifact: PreparedResearchRequestArtifact,
    claim: ResearchDispatchClaim,
    signal: AbortSignal,
  ): Promise<ResearchGatewayCapture> => {
    const request = inspectResearchRequestArtifact(artifact);
    if (!claim || typeof claim !== "object" || startedClaims.has(claim)) fail();
    // One capture invocation per local marker, including failed preflight, across factory instances.
    startedClaims.add(claim);
    const deadline = performance.now() + RESEARCH_GATEWAY_TIMEOUT_MS,
      timeout = new AbortController();
    let operational = AbortSignal.any([signal, timeout.signal]),
      stage: ResearchGatewayCaptureFailure = "preflight",
      attempted = false,
      status: number | null = null,
      media: "application/json" | null = null,
      complete = false,
      received = 0,
      failure: ResearchGatewayCaptureFailure | null = null,
      reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const chunks: Buffer[] = [],
      scanEscaped = escapedCredentialScanner(credential);
    let captured = 0,
      chunkCount = 0,
      credentialEcho = false,
      credentialTail: Buffer = Buffer.alloc(0);
    const timer = setTimeout(
      () => timeout.abort(),
      RESEARCH_GATEWAY_TIMEOUT_MS,
    );
    function alive() {
      if (performance.now() >= deadline) timeout.abort();
      if (operational.aborted) fail();
    }
    // Each await races cancellation and checks elapsed time, including event-loop delays. Late fetch bodies are discarded.
    function bounded<T>(
      promise: Promise<T>,
      late?: (value: T) => void,
    ): Promise<T> {
      return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => operational.removeEventListener("abort", aborted);
        const aborted = () => {
          if (!settled) {
            settled = true;
            cleanup();
            reject(Error(RESEARCH_GATEWAY_CAPTURE_ERROR));
          }
        };
        operational.addEventListener("abort", aborted, { once: true });
        if (operational.aborted) aborted();
        promise.then(
          (value) => {
            if (settled) {
              late?.(value);
              return;
            }
            try {
              alive();
              settled = true;
              cleanup();
              resolve(value);
            } catch {
              settled = true;
              cleanup();
              late?.(value);
              reject(Error(RESEARCH_GATEWAY_CAPTURE_ERROR));
            }
          },
          () => {
            if (!settled) {
              settled = true;
              cleanup();
              reject(Error(RESEARCH_GATEWAY_CAPTURE_ERROR));
            }
          },
        );
      });
    }
    try {
      alive();
      const init: RequestInit = {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: request.packet.body_json,
      };
      await bounded(
        Promise.resolve(beforeDispatch(artifact, claim, operational)),
      );
      alive();
      const readiness: unknown = beforeHandoff?.(artifact, claim, operational);
      if (readiness !== undefined) {
        // A mistakenly async readiness check cannot defer authority or create an unhandled rejection.
        void Promise.resolve(readiness).catch(() => {});
        fail();
      }
      alive();
      stage = "handoff";
      const network: unknown = consume(claim, artifact, operational);
      if (!(network instanceof AbortSignal)) {
        // An accidentally async port must not create an unhandled rejection or ever reach fetch.
        void Promise.resolve(network).catch(() => {});
        fail();
      }
      operational = AbortSignal.any([network, operational]);
      alive();
      const freshness: unknown = beforeRequest?.(artifact, claim, operational);
      if (freshness !== undefined) {
        void Promise.resolve(freshness).catch(() => {});
        fail();
      }
      alive();
      stage = "request";
      attempted = true;
      // No await, journal or caller work follows the final synchronous freshness check before this single fetch.
      const response = await bounded(
        Promise.resolve(
          requestFetch(RESEARCH_GATEWAY_ENDPOINT, {
            ...init,
            signal: operational,
          }),
        ),
        discardBody,
      );
      alive();
      status =
        Number.isInteger(response.status) &&
        response.status >= 100 &&
        response.status <= 599
          ? response.status
          : null;
      media =
        response.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() === "application/json"
          ? "application/json"
          : null;
      if (
        response.redirected ||
        (response.url && response.url !== RESEARCH_GATEWAY_ENDPOINT)
      ) {
        discardBody(response);
        stage = "http";
        fail();
      }
      stage = "body_unavailable";
      if (!response.body || response.body.locked || response.bodyUsed) fail();
      reader = response.body.getReader();
      stage = "read";
      while (true) {
        alive();
        const next = await bounded(reader.read());
        alive();
        if (next.done) {
          complete = true;
          break;
        }
        if (!(next.value instanceof Uint8Array)) fail();
        received += next.value.byteLength;
        // Inspect all received bytes before truncating; an echoed key can cross chunks or the byte-limit boundary.
        const view = Buffer.from(
            next.value.buffer,
            next.value.byteOffset,
            next.value.byteLength,
          ),
          overlap = Buffer.concat([
            credentialTail,
            view.subarray(0, credential.length - 1),
          ]);
        if (
          view.includes(credential) ||
          overlap.includes(credential) ||
          scanEscaped(view)
        ) {
          credentialEcho = true;
          stage = "credential_echo";
          fail();
        }
        credentialTail =
          view.length >= credential.length - 1
            ? Buffer.from(view.subarray(view.length - credential.length + 1))
            : Buffer.from(
                Buffer.concat([credentialTail, view]).subarray(
                  -(credential.length - 1),
                ),
              );
        if (++chunkCount > RESEARCH_GATEWAY_MAX_CHUNKS) fail();
        const remaining = RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT - captured,
          keep = Math.min(remaining, next.value.byteLength);
        if (keep > 0) {
          chunks.push(Buffer.from(next.value.subarray(0, keep)));
          captured += keep;
        }
        if (next.value.byteLength > remaining) {
          stage = "too_large";
          fail();
        }
      }
      if (status !== 200) failure = "http";
      else if (media !== "application/json") failure = "media_type";
    } catch {
      failure = timeout.signal.aborted
        ? "deadline"
        : operational.aborted
          ? "cancelled"
          : stage;
    } finally {
      clearTimeout(timer);
      if (reader) {
        try {
          if (!complete) void reader.cancel().catch(() => {});
        } catch {}
        try {
          reader.releaseLock();
        } catch {}
      }
      // Dispose this request's network work without aborting the caller's original controller.
      timeout.abort();
    }
    let raw = Buffer.concat(chunks);
    // Drop literal and JSON-escaped known credential echoes, including across chunk/byte-limit boundaries.
    if (credentialEcho) {
      raw = Buffer.alloc(0);
      failure = "credential_echo";
      complete = false;
    }
    const metadata: ResearchGatewayCaptureMetadata = {
      schema_version: 1,
      transport_profile: "gateway-responses-capture-v1",
      request_artifact_sha256: request.packet_sha256,
      attempted,
      http_status: status,
      media_type: media,
      complete,
      received_bytes: received,
      captured_bytes: raw.byteLength,
      captured_sha256: sha(raw),
      failure,
    };
    const token = Object.freeze({ revision: sha(JSON.stringify(metadata)) });
    captures.set(token, { artifact, claim, metadata, raw });
    return token;
  };
}
