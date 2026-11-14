/** Pure owned history input/audit data. No SQL, auth, completion grant, quota, provider or activation. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import {
  parseResearchAccountingTarget,
  type ResearchAccountingScope,
} from "./accountingScope";
import { parseResearchAnswer } from "./answer";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./artifactRetention";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  formatResearchHistoryCandidate,
  RESEARCH_HISTORY_ASSISTANT_BYTE_LIMIT,
  type ResearchCompletedHistoryCandidate,
} from "./historyCandidate";
import {
  parseResearchSourceContext,
  type ResearchSourceContext,
} from "./sourceAuthorization";

const ERROR = "Private research history input unavailable";
function fail(): never {
  throw Error(ERROR);
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$(?![\s\S])/));
const uuid = v.pipe(
  v.string(),
  v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
);
const instant = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const mode = v.picklist(["passage", "inventory", "comparison"]);
const bindingShape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("original-completed-answer"),
  window_id: uuid,
  window_begins_at_ms: instant,
  window_expires_at_ms: instant,
  permit_id: uuid,
  answer_id: uuid,
  mode,
  request_revision: hash,
  query_revision: hash,
  request_artifact_sha256: hash,
  answer_sha256: hash,
  response_artifact_sha256: hash,
  original_context: v.unknown(),
  original_context_sha256: hash,
  question_sha256: hash,
  history_text_sha256: hash,
  reserved_at_ms: instant,
  retain_until_ms: instant,
});
/** Native Unix facts only. Original context is provenance; it never authenticates the current session. */
export type ResearchHistoryBinding = Omit<
  v.InferOutput<typeof bindingShape>,
  "original_context"
> & { readonly original_context: ResearchSourceContext };
/** Only a trusted actual paired reader should supply the candidate. Compilation itself creates no completion/source authority. */
export interface ResearchHistoryPreparation {
  readonly candidate: ResearchCompletedHistoryCandidate;
  readonly scope: ResearchAccountingScope;
}
/** These two quoted records are context, not current source evidence. */
export type ResearchHistoryMessages = [
  { role: "user"; content: string },
  { role: "assistant"; content: string },
];
/** Parse the entire canonical legacy quote, preserving all qualifications and its answer-specific ID namespace. */
export function readQualifiedResearchHistory(question: unknown, text: unknown) {
  try {
    if (
      typeof text !== "string" ||
      !text.isWellFormed() ||
      Buffer.byteLength(text) > RESEARCH_HISTORY_ASSISTANT_BYTE_LIMIT
    )
      fail();
    const first = text.indexOf("\n\n"),
      second = first < 0 ? -1 : text.indexOf("\n\n", first + 2);
    if (second < 0) fail();
    const answer = parseResearchAnswer(
      parseBoundedResearchJson(
        text.slice(second + 2),
        RESEARCH_HISTORY_ASSISTANT_BYTE_LIMIT,
      ),
    );
    const qualified = formatResearchHistoryCandidate(question, answer);
    if (!qualified || qualified.text !== text || answer.origin !== "model")
      fail();
    const messages: ResearchHistoryMessages = [
      { role: "user", content: qualified.question },
      { role: "assistant", content: qualified.text },
    ];
    return { qualified, answer, messages };
  } catch {
    return fail();
  }
}
/** Normalize private audit data against a NEW current processing context; never rewrite or authorize using the original session. */
export function normalizeResearchHistoryBinding(
  value: unknown,
  currentContext: ResearchSourceContext,
): ResearchHistoryBinding {
  try {
    const b = v.parse(bindingShape, value),
      original = parseResearchSourceContext(b.original_context),
      current = parseResearchSourceContext(currentContext);
    if (
      b.window_expires_at_ms <= b.window_begins_at_ms ||
      b.window_expires_at_ms - b.window_begins_at_ms > 86400000 ||
      b.reserved_at_ms < b.window_begins_at_ms ||
      b.reserved_at_ms >= b.window_expires_at_ms ||
      b.retain_until_ms - b.reserved_at_ms !== RESEARCH_ARTIFACT_RETENTION_MS ||
      current.expires_at_ms > b.window_expires_at_ms ||
      current.expires_at_ms > b.retain_until_ms ||
      original.subject.user_id !== current.subject.user_id ||
      original.corpus_version !== current.corpus_version ||
      sha(JSON.stringify(original)) !== b.original_context_sha256 ||
      original.bindings.some(
        (p) =>
          !current.bindings.some(
            (c) => JSON.stringify(c) === JSON.stringify(p),
          ),
      )
    )
      fail();
    return { ...b, original_context: original };
  } catch {
    return fail();
  }
}
/** Own and cross-check actual completion facts before an optional body is compiled. This is data validation, not adoption. */
export function prepareResearchHistoryInput(
  value: ResearchHistoryPreparation,
  currentContext: ResearchSourceContext,
  model: string,
  profile: string,
) {
  try {
    const scope = parseResearchAccountingTarget(value.scope).scope,
      c = value.candidate,
      context = parseResearchSourceContext(c.context),
      current = parseResearchSourceContext(currentContext);
    if (
      scope.model !== model ||
      scope.processorProfile !== profile ||
      c.model !== model ||
      c.processor_profile !== profile ||
      c.window_id !== scope.windowId ||
      scope.actorId !== current.subject.user_id ||
      scope.corpusVersion !== current.corpus_version ||
      !Number.isFinite(c.retention_deadline) ||
      performance.now() >= c.retention_deadline
    )
      fail();
    const { qualified, answer, messages } = readQualifiedResearchHistory(
      c.question,
      c.text,
    );
    if (
      answer.answer_id !== c.answer_id ||
      sha(JSON.stringify(answer)) !== c.answer_sha256 ||
      sha(qualified.text) !== c.history_text_sha256
    )
      fail();
    const binding = normalizeResearchHistoryBinding(
      {
        schema_version: 1,
        kind: "original-completed-answer",
        window_id: c.window_id,
        window_begins_at_ms: scope.beginsAtMs,
        window_expires_at_ms: scope.expiresAtMs,
        permit_id: c.permit_id,
        answer_id: c.answer_id,
        mode: c.mode,
        request_revision: c.request_revision,
        query_revision: c.query_revision,
        request_artifact_sha256: c.request_artifact_sha256,
        answer_sha256: c.answer_sha256,
        response_artifact_sha256: c.response_artifact_sha256,
        original_context: context,
        original_context_sha256: sha(JSON.stringify(context)),
        question_sha256: sha(qualified.question),
        history_text_sha256: sha(qualified.text),
        reserved_at_ms: c.reserved_at_ms,
        retain_until_ms: c.retain_until_ms,
      },
      current,
    );
    if (performance.now() >= c.retention_deadline) fail();
    return { messages, binding };
  } catch {
    return fail();
  }
}
/** Read a known history input without accepting arbitrary conversational prose or conferring completion authority. */
export function readResearchHistoryMessages(input: unknown) {
  try {
    const packet = v.parse(
      v.object({
        schema_version: v.literal(2),
        history: v.strictTuple([
          v.strictObject({ role: v.literal("user"), content: v.string() }),
          v.strictObject({ role: v.literal("assistant"), content: v.string() }),
        ]),
      }),
      input,
    );
    return readQualifiedResearchHistory(
      packet.history[0].content,
      packet.history[1].content,
    );
  } catch {
    return fail();
  }
}
/** Bind the exact quoted content to private provenance; IDs/window/context stay out of the provider messages. */
export function assertResearchHistoryMessages(
  binding: ResearchHistoryBinding,
  input: unknown,
) {
  const parsed = readResearchHistoryMessages(input);
  if (
    parsed.answer.answer_id !== binding.answer_id ||
    sha(JSON.stringify(parsed.answer)) !== binding.answer_sha256 ||
    sha(parsed.qualified.question) !== binding.question_sha256 ||
    sha(parsed.qualified.text) !== binding.history_text_sha256
  )
    fail();
  return parsed;
}
