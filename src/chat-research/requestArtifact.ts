/** Inactive private request-packet codec. Parsed bytes are never dispatch, completion or history authority. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  assertResearchHistoryMessages,
  normalizeResearchHistoryBinding,
  type ResearchHistoryBinding,
} from "./historyInput";
import {
  type FrozenResearchModelRequest,
  inspectFrozenResearchModelRequest,
  RESEARCH_MODEL_ID,
  RESEARCH_PROCESSOR_PROFILE,
  RESEARCH_REQUEST_BYTE_LIMIT,
  researchModelRequestRevision,
} from "./modelRequest";
import { parseResearchSourceContext } from "./sourceAuthorization";
export const RESEARCH_REQUEST_ARTIFACT_ERROR =
  "Private research request artifact unavailable";
export const RESEARCH_REQUEST_ARTIFACT_BYTE_LIMIT = 256 * 1024;
/** Prospective fixed retention, separate from any 24h spending/quote window; adoption remains a later gate. */
export { RESEARCH_ARTIFACT_RETENTION_MS } from "./artifactRetention";

const sha = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const fields = {
  storage_profile: v.literal("private-research-artifacts-30d-v1"),
  window_id: uuid,
  operation_id: uuid,
  request_revision: hash,
  query_revision: hash,
  prepared_revision: hash,
  answer_id: uuid,
  model: v.literal(RESEARCH_MODEL_ID),
  processor_profile: v.literal(RESEARCH_PROCESSOR_PROFILE),
  body_json: v.pipe(v.string(), v.minLength(1)),
  request_sha256: hash,
  source_context_sha256: hash,
  context: v.unknown(),
};
const originalShape = v.strictObject({
  schema_version: v.literal(1),
  ...fields,
});
const historyShape = v.strictObject({
  schema_version: v.literal(2),
  ...fields,
  history_binding: v.unknown(),
});
const shape = v.variant("schema_version", [originalShape, historyShape]);
type SourceContext = ReturnType<typeof parseResearchSourceContext>;
export type ResearchRequestPacket =
  | (Omit<v.InferOutput<typeof originalShape>, "context"> & {
      context: SourceContext;
    })
  | (Omit<v.InferOutput<typeof historyShape>, "context" | "history_binding"> & {
      context: SourceContext;
      history_binding: ResearchHistoryBinding;
    });
function normalize(value: unknown): ResearchRequestPacket {
  const parsed = v.parse(shape, value),
    context = parseResearchSourceContext(parsed.context);
  if (
    parsed.request_revision !==
      researchModelRequestRevision(
        parsed.query_revision,
        parsed.answer_id,
        parsed.request_sha256,
        parsed.source_context_sha256,
      ) ||
    !parsed.body_json.isWellFormed() ||
    Buffer.byteLength(parsed.body_json) > RESEARCH_REQUEST_BYTE_LIMIT ||
    sha(parsed.body_json) !== parsed.request_sha256 ||
    sha(JSON.stringify(context)) !== parsed.source_context_sha256
  )
    throw Error();
  const body = v.parse(
      v.object({ input: v.string() }),
      parseBoundedResearchJson(parsed.body_json, RESEARCH_REQUEST_BYTE_LIMIT),
    ),
    input = parseBoundedResearchJson(body.input, RESEARCH_REQUEST_BYTE_LIMIT);
  if (parsed.schema_version === 1)
    v.parse(
      v.object({
        schema_version: v.literal(1),
        history: v.pipe(v.array(v.unknown()), v.length(0)),
      }),
      input,
    );
  if (parsed.schema_version === 2) {
    const binding = normalizeResearchHistoryBinding(
      parsed.history_binding,
      context,
    );
    if (
      binding.window_id !== parsed.window_id ||
      binding.answer_id === parsed.answer_id
    )
      throw Error();
    assertResearchHistoryMessages(binding, input);
    return { ...parsed, context, history_binding: binding };
  }
  return { ...parsed, context };
}
export interface PreparedResearchRequestArtifact {
  readonly revision: string;
}
const prepared = new WeakMap<
  object,
  {
    packet: ResearchRequestPacket;
    packetJson: string;
    request: FrozenResearchModelRequest;
  }
>();
/** Factory accepts only an owned compiled request, never browser/raw-model packet JSON. No row or retention clock is created here. */
export function prepareResearchRequestArtifact(
  request: FrozenResearchModelRequest,
  windowId: string,
  operationId: string,
): PreparedResearchRequestArtifact {
  try {
    const inspection = inspectFrozenResearchModelRequest(request);
    const history =
      "history_binding" in inspection ? inspection.history_binding : undefined;
    const packet = normalize({
      schema_version: history ? 2 : 1,
      storage_profile: "private-research-artifacts-30d-v1",
      window_id: windowId,
      operation_id: operationId,
      ...inspection,
    });
    const packetJson = JSON.stringify(packet);
    if (Buffer.byteLength(packetJson) > RESEARCH_REQUEST_ARTIFACT_BYTE_LIMIT)
      throw Error();
    const value = Object.freeze({ revision: sha(packetJson) });
    prepared.set(value, { packet, packetJson, request });
    return value;
  } catch {
    throw Error(RESEARCH_REQUEST_ARTIFACT_ERROR);
  }
}
/** Owned private server data and the original live request handle; never expose it as an HTTP/quote response. */
export function inspectResearchRequestArtifact(
  value: PreparedResearchRequestArtifact,
) {
  const s = prepared.get(value);
  if (!s) throw Error(RESEARCH_REQUEST_ARTIFACT_ERROR);
  return {
    packet: structuredClone(s.packet),
    packet_json: s.packetJson,
    packet_sha256: value.revision,
    request: s.request,
  };
}
/** Checks persisted canonical bytes without constructing an opaque prepared/dispatch/completion handle. */
export function readResearchRequestPacket(
  packetJson: string,
  packetSha256: string,
): ResearchRequestPacket {
  try {
    if (
      typeof packetJson !== "string" ||
      Buffer.byteLength(packetJson) > RESEARCH_REQUEST_ARTIFACT_BYTE_LIMIT ||
      v.parse(hash, packetSha256) !== sha(packetJson)
    )
      throw Error();
    const packet = normalize(JSON.parse(packetJson));
    if (JSON.stringify(packet) !== packetJson) throw Error();
    return packet;
  } catch {
    throw Error(RESEARCH_REQUEST_ARTIFACT_ERROR);
  }
}
