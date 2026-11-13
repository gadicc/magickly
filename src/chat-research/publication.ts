/** Inactive private publication format/compiler. Preparation performs no I/O and establishes no consent or installed grant. */
import "server-only";
import { createHash } from "node:crypto";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import {
  prepareResearchReadEnvelope,
  type ResearchReadEnvelopeInput,
} from "./readAdoption";
import { readResearchRetentionProfile } from "./retentionProfile";
import {
  type ResearchSourcePolicyDocument,
  readResearchSourcePolicy,
} from "./sourcePolicy";
import {
  parseResearchSourceStorage,
  type ResearchSourceStorage,
} from "./sqlSourceReaders";

export const RESEARCH_PUBLICATION_ERROR =
  "Private research publication unavailable";
const sha = (s: string) => createHash("sha256").update(s).digest("hex"),
  hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/)),
  shape = v.strictObject({
    sourcePolicyJson: v.string(),
    sourcePolicySha256: hash,
    retentionProfileJson: v.string(),
    retentionProfileSha256: hash,
    readEnvelopeJson: v.string(),
    readEnvelopeSha256: hash,
    sourceStorage: v.unknown(),
  });
/** Canonical private setup metadata only. Independently adopting the final exact-target manifest remains a separate trusted startup action. */
export interface ResearchPublicationInput {
  readonly sourcePolicyJson: string;
  readonly sourcePolicySha256: string;
  readonly retentionProfileJson: string;
  readonly retentionProfileSha256: string;
  readonly readEnvelopeJson: string;
  readonly readEnvelopeSha256: string;
  readonly sourceStorage: ResearchSourceStorage;
}
/** Opaque server-owned compilation, not consent or authority to publish, process, spend or deliver. */
export interface PreparedResearchPublication {
  readonly kind: "prepared_private_research_publication";
  readonly sha256: string;
}
/** Private metadata for the trusted publisher only. Never emit these fields directly to an HTTP client or commit a real operator's record. */
export interface ResearchPublicationFacts {
  readonly document_json: string;
  readonly document_sha256: string;
  readonly target: ReturnType<typeof readResearchRetentionProfile>["target"];
  readonly source_storage: ReturnType<typeof parseResearchSourceStorage>;
  readonly source_policy_json: string;
  readonly source_policy_sha256: string;
  readonly source_policy: ResearchSourcePolicyDocument;
  readonly retention_profile_json: string;
  readonly read_envelope_json: string;
  readonly read_envelope_sha256: string;
  readonly read_until_ms: number;
}
const publications = new WeakMap<object, ResearchPublicationFacts>();
function fail(): never {
  throw Error(RESEARCH_PUBLICATION_ERROR);
}
function covers(
  from: number | null,
  until: number | null,
  begins: number,
  ends: number,
) {
  return (from === null || from <= begins) && (until === null || until >= ends);
}
/** Bind existing canonical formats without generating dates/IDs, stripping grants or installing any policy. This first publisher supports one operator/window per physical artifact namespace. */
export function prepareResearchPublication(
  value: ResearchPublicationInput,
): PreparedResearchPublication {
  try {
    const p = v.parse(shape, value),
      profile = readResearchRetentionProfile(
        p.retentionProfileJson,
        p.retentionProfileSha256,
      ),
      target = profile.target,
      sources = parseResearchSourceStorage(
        p.sourceStorage as ResearchSourceStorage,
      ),
      policy = readResearchSourcePolicy(
        p.sourcePolicyJson,
        p.sourcePolicySha256,
        target.scope.corpusVersion,
      ),
      read = prepareResearchReadEnvelope(
        parseBoundedResearchJson(
          p.readEnvelopeJson,
          4096,
        ) as ResearchReadEnvelopeInput,
      ),
      readDocument = JSON.parse(
        read.document_json,
      ) as ResearchReadEnvelopeInput;
    if (
      read.document_json !== p.readEnvelopeJson ||
      read.document_sha256 !== p.readEnvelopeSha256 ||
      sources.corpusVersion !== target.scope.corpusVersion ||
      JSON.stringify([target.scope, target.storage, sources]) !==
        JSON.stringify([
          readDocument.original_scope,
          readDocument.accounting_storage,
          readDocument.source_storage,
        ])
    )
      fail();
    for (const source of policy.sources) {
      const grant = source.grants[0];
      if (
        source.state !== "active" ||
        source.grants.length !== 1 ||
        grant?.user_id !== target.scope.actorId ||
        !source.rights.generation ||
        !source.rights.answer ||
        !source.rights.metadata ||
        !grant.capabilities.generation ||
        !grant.capabilities.answer ||
        !grant.capabilities.metadata ||
        !source.rights.processor_profiles.includes(
          target.scope.processorProfile,
        ) ||
        !grant.capabilities.processor_profiles.includes(
          target.scope.processorProfile,
        ) ||
        !covers(
          source.valid_from_ms,
          source.valid_until_ms,
          target.scope.beginsAtMs,
          readDocument.read_until_ms,
        ) ||
        !covers(
          grant.valid_from_ms,
          grant.valid_until_ms,
          target.scope.beginsAtMs,
          readDocument.read_until_ms,
        )
      )
        fail();
    }
    const document = {
        schema_version: 1,
        kind: "private-operator-first-window-publication",
        mode: "one-window-and-profile-per-physical-artifact-namespace",
        scope: target.scope,
        accounting_storage: target.storage,
        source_storage: sources,
        maintenance_schema: target.maintenanceSchema,
        artifact_table_oid: target.artifactTableOid,
        source_policy_sha256: p.sourcePolicySha256,
        retention_profile_sha256: p.retentionProfileSha256,
        read_envelope_sha256: p.readEnvelopeSha256,
        runtime: profile.runtime,
        source_count: policy.sources.length,
        evidence_count: policy.sources.reduce(
          (n, source) => n + source.evidence_versions.length,
          0,
        ),
      },
      json = JSON.stringify(document),
      digest = sha(json);
    if (Buffer.byteLength(json, "utf8") > 8192) fail();
    const prepared = Object.freeze({
      kind: "prepared_private_research_publication" as const,
      sha256: digest,
    });
    publications.set(prepared, {
      document_json: json,
      document_sha256: digest,
      target,
      source_storage: sources,
      source_policy_json: p.sourcePolicyJson,
      source_policy_sha256: p.sourcePolicySha256,
      source_policy: policy,
      retention_profile_json: p.retentionProfileJson,
      read_envelope_json: p.readEnvelopeJson,
      read_envelope_sha256: p.readEnvelopeSha256,
      read_until_ms: readDocument.read_until_ms,
    });
    return prepared;
  } catch {
    return fail();
  }
}
/** Owned copies of private compiler facts only. A copied/serialized handle never becomes a valid preparation or an adoption. */
export function inspectResearchPublication(
  value: PreparedResearchPublication,
): ResearchPublicationFacts {
  const state = publications.get(value);
  if (!state) fail();
  return structuredClone(state);
}
