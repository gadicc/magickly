/** Synthetic configuration and book text only, never real accounts or source data. */

import { ungrantedResearchCatalogPolicy } from "./answerProvenance";
import {
  prepareResearchConfiguredServiceDocument,
  type ResearchConfiguredServiceDocument,
} from "./configuredService";
import { prepareResearchCorpusBundle } from "./corpusBundle";
import type { ResearchLocalStartupInput } from "./localStartup";
import { RESEARCH_MODEL_ID, RESEARCH_PROCESSOR_PROFILE } from "./modelRequest";
import { prepareResearchPublication } from "./publication";
import { publicationFixture } from "./publication.fixture";
import { queryFixture } from "./query.fixture";
import { prepareResearchReadEnvelope } from "./readAdoption";
import { prepareResearchRetentionProfile } from "./retentionProfile";
import { RESEARCH_LOCAL_RETRIEVAL_PROFILE } from "./retrieval";
import { POLICY_OWNER } from "./sourcePolicy.fixture";
export function localStartupFixture() {
  const texts = [
      "Synthetic source one.",
      "Synthetic source two.",
      "Synthetic source three.",
    ],
    q = queryFixture({ texts }),
    bundle = prepareResearchCorpusBundle(
      q.input,
      texts.map((text, i) => ({ unit_id: "unit" + (i + 1), text })),
    ),
    policy = ungrantedResearchCatalogPolicy(q.catalog),
    caps = {
      generation: true,
      answer: true,
      metadata: true,
      excerpt: false as const,
      image: false as const,
      download: false as const,
      processor_profiles: [
        RESEARCH_PROCESSOR_PROFILE,
        RESEARCH_LOCAL_RETRIEVAL_PROFILE,
      ],
    };
  for (const s of policy.sources) {
    s.state = "active";
    s.rights = structuredClone(caps);
    s.grants = [
      {
        user_id: POLICY_OWNER,
        capabilities: structuredClone(caps),
        valid_from_ms: null,
        valid_until_ms: null,
      },
    ];
  }
  const f = publicationFixture(policy);
  Object.assign(f.scope, {
    model: RESEARCH_MODEL_ID,
    processorProfile: RESEARCH_PROCESSOR_PROFILE,
  });
  const retention = prepareResearchRetentionProfile(f.retentionInput),
    read = prepareResearchReadEnvelope(f.readInput),
    input = {
      ...f.input,
      retentionProfileJson: retention.document_json,
      retentionProfileSha256: retention.document_sha256,
      readEnvelopeJson: read.document_json,
      readEnvelopeSha256: read.document_sha256,
    },
    pub = prepareResearchPublication(input),
    document: ResearchConfiguredServiceDocument = {
      schema_version: 1,
      kind: "private-operator-http-service",
      publication_sha256: pub.sha256,
      corpus_manifest_sha256: bundle.manifestSha256,
      origin: "http://localhost:4179",
      web_runtime: { kind: "reviewed-local-launch", revision: "a".repeat(64) },
      authority_endpoint_identity: "b".repeat(64),
      native_target: {
        database: "magickli_dev",
        role: "magickli_dev",
        table_oids: {
          policies: 101,
          maintenance: 102,
          windows: 103,
          permits: 104,
          artifacts: 1234,
          users: 105,
          sessions: 106,
        },
      },
      ddl_contract: "outer-controlled-no-authority-table-ddl",
    },
    service = prepareResearchConfiguredServiceDocument(document),
    startup: ResearchLocalStartupInput = {
      schema_version: 1,
      kind: "private-local-research-startup",
      service_document_json: service.documentJson,
      publication_input: input,
    };
  return { bundle, startup, document, input };
}
