/** Inactive private result codec. Only a closed SQL writer can turn its bytes into an acknowledged terminal record. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import { parseResearchAnswer, type ResearchAnswer } from "./answer";
import { parseResearchAnswerDraft } from "./answerProvenance";
import {
  inspectResearchGatewayCapture,
  type ResearchGatewayCapture,
  type ResearchGatewayCaptureMetadata,
} from "./gatewayCapture";
import {
  parseResearchGatewayDraft,
  parseResearchGatewayEnvelope,
  projectResearchGatewayCandidate,
  RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT,
  type ResearchGatewayEnvelopeCandidate,
} from "./gatewayResponse";
import { RESEARCH_MODEL_ID } from "./modelRequest";
import {
  inspectResearchRequestArtifact,
  type PreparedResearchRequestArtifact,
  type ResearchRequestPacket,
  readResearchRequestPacket,
} from "./requestArtifact";
import type { ResearchDispatchClaim } from "./sqlAdmission";

export const RESEARCH_RESULT_ARTIFACT_ERROR =
  "Private research result artifact unavailable";
export const RESEARCH_RESULT_ARTIFACT_BYTE_LIMIT = 2 * 1024 * 1024;
const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
function fail(): never {
  throw Error(RESEARCH_RESULT_ARTIFACT_ERROR);
}
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const failure = v.nullable(
  v.picklist([
    "preflight",
    "handoff",
    "request",
    "read",
    "http",
    "media_type",
    "too_large",
    "cancelled",
    "deadline",
    "credential_echo",
    "body_unavailable",
  ]),
);
const captureShape = v.strictObject({
  schema_version: v.literal(1),
  transport_profile: v.literal("gateway-responses-capture-v1"),
  request_artifact_sha256: hash,
  attempted: v.boolean(),
  http_status: v.nullable(v.pipe(integer, v.minValue(100), v.maxValue(599))),
  media_type: v.nullable(v.literal("application/json")),
  complete: v.boolean(),
  received_bytes: integer,
  captured_bytes: v.pipe(
    integer,
    v.maxValue(RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT),
  ),
  captured_sha256: hash,
  failure,
});
const receiptShape = v.strictObject({
  response_sha256: hash,
  generation_id: v.pipe(v.string(), v.regex(/^gen_[A-Za-z0-9_-]{1,120}$/)),
  model: v.literal(RESEARCH_MODEL_ID),
  provider: v.literal("openai"),
  service_tier: v.literal("default"),
  reasoning_effort: v.literal("high"),
  input_tokens: integer,
  output_tokens: integer,
  reported_pico_usd: integer,
});
const bindingShape = v.strictObject({
  permitId: uuid,
  dispatchId: uuid,
  descriptorSha256: hash,
  upperPico: v.pipe(integer, v.minValue(1), v.maxValue(350000000000)),
});
/** Locked real permit identity; the SQL writer must derive this itself, never accept browser fields. */
export type ResearchResultBinding = v.InferOutput<typeof bindingShape>;
const packetShape = v.strictObject({
  schema_version: v.literal(1),
  result_profile: v.literal("private-research-result-packet-v1"),
  storage_profile: v.literal("private-research-artifacts-30d-v1"),
  binding: bindingShape,
  request_artifact_sha256: hash,
  request_revision: hash,
  query_revision: hash,
  prepared_revision: hash,
  source_context_sha256: hash,
  answer_id: uuid,
  outcome: v.picklist(["completed", "failed", "indeterminate"]),
  reason: v.picklist([
    "validated_answer",
    "not_attempted",
    "transport_failure",
    "invalid_response",
    "invalid_answer",
    "cost_exceeded",
  ]),
  reported_pico_usd: v.nullable(integer),
  receipt: v.nullable(receiptShape),
  capture_revision: hash,
  capture: captureShape,
  raw_base64: v.pipe(
    v.string(),
    v.maxLength(Math.ceil(RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT / 3) * 4),
  ),
  draft: v.unknown(),
  answer: v.unknown(),
  answer_sha256: v.nullable(hash),
});
type Receipt = Omit<ResearchGatewayEnvelopeCandidate, "text">;
type Quality =
  | "validated_answer"
  | "not_attempted"
  | "transport_failure"
  | "invalid_response"
  | "invalid_answer";
/** Opaque prepared observation, not terminal completion, a source grant or an admitted history turn. */
export interface PreparedResearchResult {
  readonly revision: string;
}
interface Observation {
  artifact: PreparedResearchRequestArtifact;
  claim: ResearchDispatchClaim;
  metadata: ResearchGatewayCaptureMetadata;
  captureRevision: string;
  raw: Uint8Array;
  quality: Quality;
  receipt: Receipt | null;
  draft: ReturnType<typeof parseResearchAnswerDraft> | null;
  answer: ResearchAnswer | null;
}
const observations = new WeakMap<object, Observation>();
const clean = (m: ResearchGatewayCaptureMetadata) =>
  m.attempted &&
  m.complete &&
  m.http_status === 200 &&
  m.media_type === "application/json" &&
  m.failure === null;
const receipt = (e: ResearchGatewayEnvelopeCandidate): Receipt => {
  const { text: _text, ...r } = e;
  return r;
};
/** Observe only an owned capture tied to the original live request and claim. No network or database operation occurs. */
export function prepareResearchResult(
  capture: ResearchGatewayCapture,
  artifact: PreparedResearchRequestArtifact,
  claim: ResearchDispatchClaim,
): PreparedResearchResult {
  try {
    const request = inspectResearchRequestArtifact(artifact),
      c = inspectResearchGatewayCapture(capture, artifact, claim),
      m = v.parse(captureShape, c.metadata);
    if (
      m.request_artifact_sha256 !== request.packet_sha256 ||
      m.captured_bytes !== c.raw.byteLength ||
      m.captured_sha256 !== sha(c.raw) ||
      m.received_bytes < m.captured_bytes
    )
      fail();
    const s: Observation = {
      artifact,
      claim,
      metadata: m,
      captureRevision: capture.revision,
      raw: Uint8Array.from(c.raw),
      quality: !m.attempted ? "not_attempted" : "transport_failure",
      receipt: null,
      draft: null,
      answer: null,
    };
    if (clean(m)) {
      s.quality = "invalid_response";
      try {
        s.receipt = receipt(parseResearchGatewayEnvelope(s.raw));
      } catch {}
      if (s.receipt) {
        s.quality = "invalid_answer";
        try {
          const candidate = projectResearchGatewayCandidate(
            s.raw,
            request.request,
          );
          s.draft = candidate.draft;
          s.answer = candidate.bound.payload;
          s.quality = "validated_answer";
        } catch {}
      }
    }
    const token = Object.freeze({
      revision: sha(
        JSON.stringify([
          "private-research-result-observation-v1",
          artifact.revision,
          capture.revision,
          s.quality,
          s.receipt,
          s.draft,
          s.answer,
        ]),
      ),
    });
    observations.set(token, s);
    return token;
  } catch {
    return fail();
  }
}
function observation(
  value: PreparedResearchResult,
  artifact: PreparedResearchRequestArtifact,
  claim: ResearchDispatchClaim,
): Observation {
  const s = observations.get(value);
  if (!s || s.artifact !== artifact || s.claim !== claim) return fail();
  return s;
}
/** Pure deterministic response-artifact packet, from an observation and the locked real permit. Does not persist or confer completion. */
export function materializeResearchResult(
  value: PreparedResearchResult,
  artifact: PreparedResearchRequestArtifact,
  claim: ResearchDispatchClaim,
  binding: ResearchResultBinding,
) {
  try {
    const s = observation(value, artifact, claim),
      request = inspectResearchRequestArtifact(artifact),
      b = v.parse(bindingShape, binding);
    const exceeded =
        s.receipt !== null && s.receipt.reported_pico_usd > b.upperPico,
      reason = exceeded ? "cost_exceeded" : s.quality,
      outcome =
        reason === "validated_answer"
          ? "completed"
          : reason === "not_attempted" || reason === "invalid_answer"
            ? "failed"
            : "indeterminate";
    const answer = outcome === "completed" ? s.answer : null,
      draft = outcome === "completed" ? s.draft : null,
      answerSha = answer ? sha(JSON.stringify(answer)) : null;
    const packet = normalize(
      {
        schema_version: 1,
        result_profile: "private-research-result-packet-v1",
        storage_profile: "private-research-artifacts-30d-v1",
        binding: b,
        request_artifact_sha256: request.packet_sha256,
        request_revision: request.packet.request_revision,
        query_revision: request.packet.query_revision,
        prepared_revision: request.packet.prepared_revision,
        source_context_sha256: request.packet.source_context_sha256,
        answer_id: request.packet.answer_id,
        outcome,
        reason,
        reported_pico_usd:
          reason === "not_attempted"
            ? 0
            : (s.receipt?.reported_pico_usd ?? null),
        receipt: s.receipt,
        capture_revision: s.captureRevision,
        capture: s.metadata,
        raw_base64: Buffer.from(s.raw).toString("base64"),
        draft,
        answer,
        answer_sha256: answerSha,
      },
      request.packet,
      request.packet_sha256,
    );
    const packetJson = JSON.stringify(packet);
    if (Buffer.byteLength(packetJson) > RESEARCH_RESULT_ARTIFACT_BYTE_LIMIT)
      fail();
    return { packet, packet_json: packetJson, packet_sha256: sha(packetJson) };
  } catch {
    return fail();
  }
}
function normalize(
  value: unknown,
  request: ResearchRequestPacket,
  requestSha: string,
) {
  const p = v.parse(packetShape, value),
    raw = Buffer.from(p.raw_base64, "base64"),
    r = readResearchRequestPacket(JSON.stringify(request), requestSha);
  if (
    Buffer.byteLength(JSON.stringify(p)) >
      RESEARCH_RESULT_ARTIFACT_BYTE_LIMIT ||
    raw.toString("base64") !== p.raw_base64 ||
    raw.byteLength > RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT ||
    p.capture.captured_bytes !== raw.byteLength ||
    p.capture.captured_sha256 !== sha(raw) ||
    p.capture.received_bytes < p.capture.captured_bytes ||
    p.capture_revision !== sha(JSON.stringify(p.capture)) ||
    p.request_artifact_sha256 !== requestSha ||
    p.capture.request_artifact_sha256 !== requestSha ||
    p.request_revision !== r.request_revision ||
    p.query_revision !== r.query_revision ||
    p.prepared_revision !== r.prepared_revision ||
    p.source_context_sha256 !== r.source_context_sha256 ||
    p.answer_id !== r.answer_id
  )
    fail();
  const answer = p.answer === null ? null : parseResearchAnswer(p.answer),
    draft = p.draft === null ? null : parseResearchAnswerDraft(p.draft);
  if (
    (answer ? sha(JSON.stringify(answer)) : null) !== p.answer_sha256 ||
    (answer !== null &&
      (answer.answer_id !== p.answer_id || answer.origin !== "model"))
  )
    fail();
  const isClean = clean(p.capture);
  const parsedReceipt = isClean
    ? (() => {
        try {
          return receipt(parseResearchGatewayEnvelope(raw));
        } catch {
          return null;
        }
      })()
    : null;
  if (JSON.stringify(p.receipt) !== JSON.stringify(parsedReceipt)) fail();
  const reported =
    p.reason === "not_attempted" ? 0 : (p.receipt?.reported_pico_usd ?? null);
  if (p.reported_pico_usd !== reported) fail();
  const validOutcome =
    p.reason === "validated_answer"
      ? "completed"
      : p.reason === "not_attempted" || p.reason === "invalid_answer"
        ? "failed"
        : "indeterminate";
  if (p.outcome !== validOutcome) fail();
  if (p.reason === "not_attempted") {
    if (
      p.capture.attempted ||
      p.receipt !== null ||
      p.capture.complete ||
      raw.length !== 0 ||
      p.capture.received_bytes !== 0 ||
      p.capture.http_status !== null
    )
      fail();
  } else if (!p.capture.attempted) fail();
  if (p.reason === "transport_failure" && isClean) fail();
  if (p.reason === "invalid_response" && (!isClean || p.receipt !== null))
    fail();
  if (
    ["validated_answer", "invalid_answer", "cost_exceeded"].includes(
      p.reason,
    ) &&
    (!isClean || !p.receipt)
  )
    fail();
  if (
    p.receipt &&
    p.receipt.reported_pico_usd > p.binding.upperPico &&
    p.reason !== "cost_exceeded"
  )
    fail();
  if (
    p.reason === "cost_exceeded" &&
    p.reported_pico_usd! <= p.binding.upperPico
  )
    fail();
  if (p.outcome === "completed") {
    if (!answer || !draft || p.reported_pico_usd! > p.binding.upperPico) fail();
    const { draft: observed } = parseResearchGatewayDraft(raw);
    if (
      JSON.stringify(observed) !== JSON.stringify(draft) ||
      answer.status !== draft.status
    )
      fail();
  } else if (answer !== null || draft !== null || p.answer_sha256 !== null)
    fail();
  return { ...p, draft, answer };
}
/** Private canonical packet data only. Never deserialize a capture/result handle, return this on HTTP or admit history directly. */
export function readResearchResultPacket(
  packetJson: string,
  packetSha: string,
  request: ResearchRequestPacket,
  requestArtifactSha: string,
) {
  try {
    if (
      typeof packetJson !== "string" ||
      Buffer.byteLength(packetJson) > RESEARCH_RESULT_ARTIFACT_BYTE_LIMIT ||
      v.parse(hash, packetSha) !== sha(packetJson)
    )
      fail();
    const packet = normalize(
      JSON.parse(packetJson),
      request,
      requestArtifactSha,
    );
    if (JSON.stringify(packet) !== packetJson) fail();
    return packet;
  } catch {
    return fail();
  }
}
