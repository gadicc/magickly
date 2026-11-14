/** Inactive response candidate validation. Caller-supplied bytes are never HTTP, billing settlement or history authority. */
import "server-only";
import { createHash } from "node:crypto";
import { parseResearchAnswerDraft } from "./answerProvenance";
import { parseBoundedResearchJson as parseJson } from "./boundedJson";
import {
  assertResearchRequestAnswer,
  type FrozenResearchModelRequest,
  projectResearchRequestAnswer,
  RESEARCH_MODEL_ID,
  RESEARCH_OUTPUT_TOKEN_LIMIT,
} from "./modelRequest";

export const RESEARCH_GATEWAY_RESPONSE_ERROR =
  "Private research response unavailable";
export const RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT = 1024 * 1024;
function fail(): never {
  throw Error(RESEARCH_GATEWAY_RESPONSE_ERROR);
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
};
const empty = (value: unknown) => value === undefined || value === null;
function optionalEmptyArray(value: unknown) {
  if (value !== undefined && (!Array.isArray(value) || value.length !== 0))
    fail();
}
/** Exact decimal USD to integer pico-USD, rounding upward once. No float arithmetic or quoted spending permission. */
export function researchResponseUsdToPico(value: unknown): number {
  if (typeof value !== "string" || value.length > 64) return fail();
  const m = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!m || m[0] !== value) return fail();
  const fraction = m[2] ?? "",
    power = 12 + Number(m[3] ?? 0) - fraction.length;
  if (!Number.isSafeInteger(power) || Math.abs(power) > 40) return fail();
  const n = BigInt(m[1] + fraction),
    p = BigInt(10) ** BigInt(Math.abs(power));
  const result = power >= 0 ? n * p : (n + p - BigInt(1)) / p;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) return fail();
  return Number(result);
}
function count(a: unknown, b: unknown): number {
  if (a !== undefined && b !== undefined && a !== b) return fail();
  const value = a ?? b;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    return fail();
  return value;
}
/** Parsed assertion fields only; not proof these bytes came from a completed authorized network attempt. */
export interface ResearchGatewayEnvelopeCandidate {
  readonly response_sha256: string;
  readonly text: string;
  readonly generation_id: string;
  readonly model: typeof RESEARCH_MODEL_ID;
  readonly provider: "openai";
  readonly service_tier: "default";
  readonly reasoning_effort: "high";
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly reported_pico_usd: number;
}
/** Full UTF-8 JSON body validation without credentials, transport, retries, result storage or answer delivery. */
export function parseResearchGatewayEnvelope(
  bytes: Uint8Array,
): ResearchGatewayEnvelopeCandidate {
  try {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength === 0 ||
      bytes.byteLength > RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT
    )
      fail();
    const owned = Buffer.from(bytes),
      raw = object(
        parseJson(
          new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
            owned,
          ),
          RESEARCH_GATEWAY_RESPONSE_BYTE_LIMIT,
        ),
      );
    if (
      raw.providerMetadata !== undefined &&
      raw.provider_metadata !== undefined
    )
      fail();
    const metadata = object(raw.providerMetadata ?? raw.provider_metadata),
      gateway = object(metadata.gateway),
      routing = object(gateway.routing),
      usage = object(raw.usage);
    if (
      raw.object !== "response" ||
      raw.status !== "completed" ||
      !empty(raw.error) ||
      !empty(raw.incomplete_details) ||
      !empty(raw.previous_response_id) ||
      !empty(raw.conversation) ||
      !empty(raw.prompt) ||
      (raw.truncation !== undefined && raw.truncation !== "disabled") ||
      typeof raw.model !== "string" ||
      ![RESEARCH_MODEL_ID, RESEARCH_MODEL_ID.split("/")[1]].includes(
        raw.model,
      ) ||
      raw.service_tier !== "default" ||
      raw.store !== false ||
      (raw.background !== undefined && raw.background !== false) ||
      raw.max_output_tokens !== RESEARCH_OUTPUT_TOKEN_LIMIT ||
      object(raw.reasoning).effort !== "high"
    )
      fail();
    optionalEmptyArray(raw.warnings);
    optionalEmptyArray(raw.tools);
    optionalEmptyArray(raw.allowed_tools);
    if (
      raw.tool_choice !== undefined &&
      raw.tool_choice !== "auto" &&
      raw.tool_choice !== "none"
    )
      fail();
    optionalEmptyArray(gateway.warnings);
    if (
      routing.finalProvider !== "openai" ||
      (routing.resolvedProvider !== undefined &&
        routing.resolvedProvider !== "openai") ||
      routing.totalProviderAttemptCount !== 1 ||
      routing.modelAttemptCount !== 1 ||
      !Array.isArray(routing.fallbacksAvailable) ||
      routing.fallbacksAvailable.length !== 0 ||
      !Array.isArray(routing.modelAttempts) ||
      routing.modelAttempts.length !== 1
    )
      fail();
    for (const field of ["originalModelId", "canonicalSlug"])
      if (routing[field] !== undefined && routing[field] !== RESEARCH_MODEL_ID)
        fail();
    const model = object(routing.modelAttempts[0]);
    if (
      model.canonicalSlug !== RESEARCH_MODEL_ID ||
      model.success !== true ||
      !empty(model.error) ||
      model.providerAttemptCount !== 1 ||
      !Array.isArray(model.providerAttempts) ||
      model.providerAttempts.length !== 1
    )
      fail();
    const provider = object(model.providerAttempts[0]);
    if (
      provider.provider !== "openai" ||
      provider.success !== true ||
      !empty(provider.error) ||
      provider.credentialType !== "system"
    )
      fail();
    if (metadata.openai !== undefined) {
      const openai = object(metadata.openai);
      for (const field of ["serviceTier", "service_tier"])
        if (openai[field] !== undefined && openai[field] !== "default") fail();
      if (
        openai.reasoningEffort !== undefined &&
        openai.reasoningEffort !== "high"
      )
        fail();
    }
    const id = gateway.generationId;
    if (
      typeof id !== "string" ||
      !/^gen_[A-Za-z0-9_-]{1,120}$/.test(id) ||
      raw.id !== id
    )
      fail();
    if (!Array.isArray(raw.output)) fail();
    const messages: Record<string, unknown>[] = [];
    for (const item of raw.output) {
      const part = object(item);
      if (part.type === "reasoning") {
        if (!empty(part.status) && part.status !== "completed") fail();
        continue;
      }
      if (
        part.type !== "message" ||
        part.role !== "assistant" ||
        part.status !== "completed" ||
        !Array.isArray(part.content) ||
        part.content.length !== 1
      )
        fail();
      messages.push(part);
    }
    if (messages.length !== 1) fail();
    const content = object((messages[0].content as unknown[])[0]);
    if (
      content.type !== "output_text" ||
      typeof content.text !== "string" ||
      content.text.length === 0 ||
      Buffer.byteLength(content.text) > 128 * 1024
    )
      fail();
    optionalEmptyArray(content.annotations);
    if (raw.output_text !== undefined && raw.output_text !== content.text)
      fail();
    const input = count(usage.input_tokens, usage.inputTokens),
      output = count(usage.output_tokens, usage.outputTokens);
    if (
      input === 0 ||
      output === 0 ||
      output > RESEARCH_OUTPUT_TOKEN_LIMIT ||
      !Number.isSafeInteger(input + output)
    )
      fail();
    if (usage.total_tokens !== undefined || usage.totalTokens !== undefined)
      if (count(usage.total_tokens, usage.totalTokens) !== input + output)
        fail();
    if (usage.input_tokens_details !== undefined) {
      const d = object(usage.input_tokens_details);
      if (
        d.cached_tokens !== undefined &&
        count(d.cached_tokens, undefined) > input
      )
        fail();
    }
    if (usage.output_tokens_details !== undefined) {
      const d = object(usage.output_tokens_details);
      if (
        d.reasoning_tokens !== undefined &&
        count(d.reasoning_tokens, undefined) > output
      )
        fail();
    }
    return {
      response_sha256: createHash("sha256").update(owned).digest("hex"),
      text: content.text,
      generation_id: id,
      model: RESEARCH_MODEL_ID,
      provider: "openai",
      service_tier: "default",
      reasoning_effort: "high",
      input_tokens: input,
      output_tokens: output,
      reported_pico_usd: researchResponseUsdToPico(gateway.cost),
    };
  } catch {
    return fail();
  }
}
/** Owned envelope/minimal-draft data only, shared by live projection and persisted-packet consistency checks. */
export function parseResearchGatewayDraft(bytes: Uint8Array) {
  try {
    const envelope = parseResearchGatewayEnvelope(bytes),
      draft = parseResearchAnswerDraft(parseJson(envelope.text, 128 * 1024));
    return { envelope, draft };
  } catch {
    return fail();
  }
}
/** Request-bound typed candidate only. No raw JSON/draft can certify a network capture or completed terminal permit. */
export function projectResearchGatewayCandidate(
  bytes: Uint8Array,
  request: FrozenResearchModelRequest,
) {
  try {
    const { envelope, draft } = parseResearchGatewayDraft(bytes),
      answer = projectResearchRequestAnswer(request, draft);
    const bound = assertResearchRequestAnswer(request, answer, draft);
    return { envelope, draft, answer, bound };
  } catch {
    return fail();
  }
}
