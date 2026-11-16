/** Synthetic hosted startup only. No real account, corpus, endpoint, secret, deployment or adoption. */
import { prepareResearchConfiguredServiceDocument } from "./configuredService";
import { localStartupFixture } from "./localStartup.fixture";
import {
  proposeResearchManagedOperatorStartup,
  type ResearchManagedOperatorStartupInput,
} from "./managedOperatorStartup";
import { managedPublicationFixture } from "./managedPublication.fixture";
import { prepareResearchManagedRetentionProfile } from "./managedRetentionProfile";
import { prepareResearchManagedPublication } from "./publication";
/** New managed purpose around the existing canonical synthetic corpus and policy. */
export function managedOperatorStartupFixture() {
  const local = localStartupFixture(),
    runtime = {
      ...managedPublicationFixture().profileInput.runtime,
      node_major: 24 as const,
    },
    retention = prepareResearchManagedRetentionProfile({
      ...JSON.parse(local.input.retentionProfileJson),
      schema_version: 2,
      kind: "private-research-managed-retention",
      runtime,
    }),
    publicationInput = {
      ...local.input,
      retentionProfileJson: retention.document_json,
      retentionProfileSha256: retention.document_sha256,
    },
    publication = prepareResearchManagedPublication(publicationInput),
    document = {
      ...local.document,
      publication_sha256: publication.sha256,
      web_runtime: {
        kind: "immutable-deployment" as const,
        revision: local.document.web_runtime.revision,
      },
    },
    service = prepareResearchConfiguredServiceDocument(document),
    input: ResearchManagedOperatorStartupInput = {
      schema_version: 2,
      kind: "private-managed-operator-query-service-startup",
      service_document_json: service.documentJson,
      publication_input: publicationInput,
    },
    proposal = proposeResearchManagedOperatorStartup(input);
  return { bundle: local.bundle, runtime, document, input, proposal };
}
