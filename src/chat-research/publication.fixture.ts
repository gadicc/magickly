/** Synthetic publication metadata only; no account, book content, consent, filesystem or database. */

import type { ResearchPublicationInput } from "./publication";
import {
  prepareResearchReadEnvelope,
  RESEARCH_MAX_READ_WINDOW_MS,
  type ResearchReadEnvelopeInput,
} from "./readAdoption";
import {
  prepareResearchRetentionProfile,
  type ResearchRetentionProfileInput,
} from "./retentionProfile";
import {
  prepareResearchSourcePolicy,
  type ResearchSourcePolicyInput,
} from "./sourcePolicy";
import {
  POLICY_OWNER,
  POLICY_PROFILE,
  sourcePolicyFixture,
} from "./sourcePolicy.fixture";
/** Owned fake canonical inputs for compiler/SQL/native controls; callers may replace the synthetic storage/OID/scope before recompiling. */
export function publicationFixture(
  policy: ResearchSourcePolicyInput = sourcePolicyFixture(),
) {
  const source = prepareResearchSourcePolicy(policy),
    scope = {
      windowId: "019ba96c-1000-7000-8000-000000000001",
      approvalSha256: "a".repeat(64),
      actorId: POLICY_OWNER,
      corpusVersion: source.corpusVersion,
      model: "synthetic-model",
      processorProfile: POLICY_PROFILE,
      beginsAtMs: 1000,
      expiresAtMs: 3601000,
      maxRequests: 10,
      perRequestPico: 100,
      totalPico: 1000,
    },
    sourceStorage = {
      schemaName: "synthetic_policy",
      authSchemaName: "synthetic_auth",
      corpusVersion: source.corpusVersion,
    },
    retentionInput: ResearchRetentionProfileInput = {
      schema_version: 1,
      kind: "private-research-retention",
      scope,
      storage: { schemaName: "synthetic_artifacts" },
      maintenance_schema: "synthetic_maintenance",
      artifact_table_oid: 1234,
      runtime: {
        worker_sha256: "c".repeat(64),
        node_sha256: "d".repeat(64),
        input_inventory_sha256: "e".repeat(64),
      },
      packet_retention_ms: 30 * 86400000,
      purge_lag_ms: 3600000,
      cadence_ms: 3600000,
      stale_after_ms: 7200000,
      batch_size: 100,
      cleanup_scope: "all-expired-packets-in-physical-artifact-namespace",
      stop: "native-all-windows-closed-and-all-payloads-purged",
    },
    retention = prepareResearchRetentionProfile(retentionInput),
    readInput: ResearchReadEnvelopeInput = {
      schema_version: 1,
      kind: "private-operator-retained-read",
      original_scope: scope,
      accounting_storage: retentionInput.storage,
      source_storage: sourceStorage,
      read_until_ms: scope.beginsAtMs + RESEARCH_MAX_READ_WINDOW_MS,
      packet_retention_ms: 30 * 86400000,
      display: "answers-and-citations",
      excerpts: false,
      images: false,
      downloads: false,
      mutable_read_authority: "original-corpus-source-policy",
    },
    read = prepareResearchReadEnvelope(readInput),
    input: ResearchPublicationInput = {
      sourcePolicyJson: source.policyJson,
      sourcePolicySha256: source.policySha256,
      retentionProfileJson: retention.document_json,
      retentionProfileSha256: retention.document_sha256,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
      sourceStorage,
    };
  return {
    input,
    policy,
    source,
    scope,
    sourceStorage,
    retentionInput,
    readInput,
  };
}
