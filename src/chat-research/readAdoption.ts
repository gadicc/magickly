/** Inactive immutable read-envelope compiler/guard. Preparation is not operator consent or a source grant. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import {
  parseResearchAccountingTarget,
  type ResearchAccountingScope,
  type ResearchAccountingStorage,
} from "./accountingScope";
import { parseBoundedResearchJson } from "./boundedJson";
import { RESEARCH_ARTIFACT_RETENTION_MS } from "./requestArtifact";
import type {
  ResearchRetainedDeliveryOptions,
  ResearchRetainedReadBinding,
} from "./retainedDelivery";
import { parseResearchSourceContext } from "./sourceAuthorization";
import type { ResearchAdmissionDatabase } from "./sqlAdmission";
import {
  parseResearchSourceStorage,
  type ResearchSourceStorage,
} from "./sqlSourceReaders";

export const RESEARCH_READ_ADOPTION_ERROR =
  "Private research read scope unavailable";
export const RESEARCH_MAX_READ_WINDOW_MS = 7 * 86400000;
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const instant = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
function fail(): never {
  throw Error(RESEARCH_READ_ADOPTION_ERROR);
}
const shape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("private-operator-retained-read"),
  original_scope: v.unknown(),
  accounting_storage: v.unknown(),
  source_storage: v.unknown(),
  read_until_ms: instant,
  packet_retention_ms: v.literal(RESEARCH_ARTIFACT_RETENTION_MS),
  display: v.literal("answers-and-citations"),
  excerpts: v.literal(false),
  images: v.literal(false),
  downloads: v.literal(false),
  mutable_read_authority: v.literal("original-corpus-source-policy"),
});
export interface ResearchReadEnvelopeInput {
  readonly schema_version: 1;
  readonly kind: "private-operator-retained-read";
  readonly original_scope: ResearchAccountingScope;
  readonly accounting_storage: ResearchAccountingStorage;
  readonly source_storage: ResearchSourceStorage;
  readonly read_until_ms: number;
  readonly packet_retention_ms: typeof RESEARCH_ARTIFACT_RETENTION_MS;
  readonly display: "answers-and-citations";
  readonly excerpts: false;
  readonly images: false;
  readonly downloads: false;
  readonly mutable_read_authority: "original-corpus-source-policy";
}
/** Owned canonical data only. No date/ID is generated, and no read/provider authority is minted. */
export function prepareResearchReadEnvelope(value: ResearchReadEnvelopeInput) {
  try {
    const p = v.parse(shape, value),
      t = parseResearchAccountingTarget(
        p.original_scope as ResearchAccountingScope,
        p.accounting_storage as ResearchAccountingStorage,
      ),
      sources = parseResearchSourceStorage(
        p.source_storage as ResearchSourceStorage,
      );
    if (
      sources.corpusVersion !== t.scope.corpusVersion ||
      p.read_until_ms < t.scope.expiresAtMs ||
      p.read_until_ms <= t.scope.beginsAtMs ||
      p.read_until_ms - t.scope.beginsAtMs > RESEARCH_MAX_READ_WINDOW_MS
    )
      fail();
    const document = {
        schema_version: p.schema_version,
        kind: p.kind,
        original_scope: t.scope,
        accounting_storage: t.storage,
        source_storage: sources,
        read_until_ms: p.read_until_ms,
        packet_retention_ms: p.packet_retention_ms,
        display: p.display,
        excerpts: p.excerpts,
        images: p.images,
        downloads: p.downloads,
        mutable_read_authority: p.mutable_read_authority,
      },
      documentJson = JSON.stringify(document);
    if (Buffer.byteLength(documentJson) > 4096) fail();
    return Object.freeze({
      document_json: documentJson,
      document_sha256: sha(documentJson),
    });
  } catch {
    return fail();
  }
}
/** Validate exact canonical bytes against an INDEPENDENTLY adopted digest from trusted startup, never a browser/profile field. */
function readEnvelope(json: string, adopted: string) {
  const value = parseBoundedResearchJson(json, 4096),
    prepared = prepareResearchReadEnvelope(value as ResearchReadEnvelopeInput);
  if (
    prepared.document_json !== json ||
    prepared.document_sha256 !== v.parse(hash, adopted)
  )
    fail();
  return JSON.parse(prepared.document_json) as ResearchReadEnvelopeInput;
}
/** Permit-free exact service scope for empty archive preflight only; no source/native/read permission is created. */
export type ResearchReadServiceBinding = Omit<
  ResearchRetainedReadBinding,
  "permit_id" | "completed"
>;
export interface ResearchReadAdoptionOptions {
  /** The outer runtime must verify actual external adoption/review/code/target provenance before configuring this guard. */
  readonly adoptedDocumentSha256: string;
  readonly documentJson: string;
  readonly database: ResearchAdmissionDatabase;
  readonly scope: ResearchAccountingScope;
  readonly storage?: ResearchAccountingStorage;
  readonly sourceStorage: ResearchSourceStorage;
}
/**
 * Static approved-envelope part of retained delivery only; CURRENT signed session/source policy is still mandatory.
 * The original corpus policy is the sole mutable read authority: revoke its answer/metadata grants or state.
 * There is intentionally no mutable file-revocation claim, per-answer revocation, generation, price or renewal API.
 * Supplying an expected digest is trusted deployment configuration, NOT evidence that a human adopted it.
 */
export function createResearchReadAdoptionPorts(
  options: ResearchReadAdoptionOptions,
) {
  try {
    const document = readEnvelope(
        options.documentJson,
        options.adoptedDocumentSha256,
      ),
      database = options.database,
      t = parseResearchAccountingTarget(options.scope, options.storage),
      sources = parseResearchSourceStorage(options.sourceStorage),
      targetJson = JSON.stringify([t.scope, t.storage, sources]);
    if (
      targetJson !==
      JSON.stringify([
        document.original_scope,
        document.accounting_storage,
        document.source_storage,
      ])
    )
      fail();
    const assertReadServiceScope = (
      binding: ResearchReadServiceBinding,
      signal: AbortSignal,
    ): undefined => {
      try {
        signal.throwIfAborted();
        const actual = parseResearchAccountingTarget(
            binding.scope,
            binding.storage,
          ),
          source = parseResearchSourceStorage(binding.source_storage);
        if (
          binding.database !== database ||
          targetJson !==
            JSON.stringify([actual.scope, actual.storage, source]) ||
          binding.read_until_ms !== document.read_until_ms ||
          binding.current_subject.kind !== "user" ||
          binding.current_subject.user_id !== t.scope.actorId ||
          !isUuidV7(binding.current_subject.session_id) ||
          binding.current_subject.session_id !==
            binding.current_subject.session_id.toLowerCase()
        )
          fail();
        return undefined;
      } catch {
        return fail();
      }
    };
    const check = (
      stage: "prepare" | "delivery",
      binding: ResearchRetainedReadBinding,
      signal: AbortSignal,
    ): undefined => {
      try {
        assertReadServiceScope(binding, signal);
        if (
          !isUuidV7(binding.permit_id) ||
          binding.permit_id !== binding.permit_id.toLowerCase() ||
          (stage === "prepare"
            ? binding.completed !== null
            : !binding.completed)
        )
          fail();
        if (stage === "delivery") {
          const completed = binding.completed!;
          for (const value of [
            completed.answer_sha256,
            completed.response_artifact_sha256,
            completed.request_revision,
            completed.query_revision,
            completed.original_source_context_sha256,
          ])
            v.parse(hash, value);
          const context = parseResearchSourceContext(
            parseBoundedResearchJson(
              completed.original_source_context_json,
              64 * 1024,
            ),
          );
          if (
            sha(completed.original_source_context_json) !==
              completed.original_source_context_sha256 ||
            JSON.stringify(context) !==
              completed.original_source_context_json ||
            context.subject.user_id !== t.scope.actorId ||
            context.corpus_version !== t.scope.corpusVersion ||
            !Number.isSafeInteger(completed.retain_until_ms) ||
            completed.retain_until_ms <
              t.scope.beginsAtMs + RESEARCH_ARTIFACT_RETENTION_MS ||
            completed.retain_until_ms >=
              t.scope.expiresAtMs + RESEARCH_ARTIFACT_RETENTION_MS
          )
            fail();
        }
        return undefined;
      } catch {
        return fail();
      }
    };
    const requireReadActive: ResearchRetainedDeliveryOptions["requireReadActive"] =
      async (stage, binding, signal) => {
        if (stage !== "prepare" && stage !== "delivery") fail();
        check(stage, binding, signal);
      };
    return Object.freeze({
      readUntilMs: document.read_until_ms,
      assertReadServiceScope,
      requireReadActive,
      assertReadReady: (
        binding: ResearchRetainedReadBinding,
        signal: AbortSignal,
      ): undefined => check("delivery", binding, signal),
    });
  } catch {
    return fail();
  }
}
