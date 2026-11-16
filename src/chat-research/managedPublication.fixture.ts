/** Synthetic managed metadata for tests only; no real deployment, source, account or custody. */
import {
  prepareResearchManagedRetentionProfile,
  type ResearchManagedRetentionProfileInput,
} from "./managedRetentionProfile";
import { publicationFixture } from "./publication.fixture";
/** Rebuild only the synthetic managed profile; caller-owned scope/storage/read-envelope changes must already be consistent. */
export function managedPublicationFixture(f = publicationFixture()) {
  const profileInput: ResearchManagedRetentionProfileInput = {
      ...f.retentionInput,
      schema_version: 2,
      kind: "private-research-managed-retention",
      runtime: {
        platform: "vercel",
        node_major: 22,
        region: "lhr1",
        worker_artifact_sha256: "1".repeat(64),
        dependency_lock_sha256: "2".repeat(64),
        critical_inputs_sha256: "3".repeat(64),
        project_scope_sha256: "4".repeat(64),
        custody_contract: "independently-reviewed-protected-release",
      },
    },
    profile = prepareResearchManagedRetentionProfile(profileInput);
  return {
    ...f,
    profileInput,
    profile,
    managedInput: {
      ...f.input,
      retentionProfileJson: profile.document_json,
      retentionProfileSha256: profile.document_sha256,
    },
  };
}
