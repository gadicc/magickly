/** Synthetic independent cleanup deployment only. No real target, identity, token or adoption. */
import { createHash } from "node:crypto";
import { researchManagedCleanupConnectionIdentity } from "./managedCleanup";
import { managedPublicationFixture } from "./managedPublication.fixture";
import { prepareResearchManagedRetentionProfile } from "./managedRetentionProfile";
export function managedCleanupEntryFixture() {
  const f = managedPublicationFixture(),
    runtime = { ...f.profileInput.runtime, node_major: 24 as const },
    profile = prepareResearchManagedRetentionProfile({
      ...f.profileInput,
      runtime,
    });
  const identity = {
    host: "ep-synthetic.eu-west-2.aws.neon.tech",
    database: "synthetic_research",
    role: "magickli_research_cleanup_v1",
  };
  const raw = JSON.stringify({
    schema_version: 1,
    documentJson: profile.document_json,
  });
  const deployment = {
    schema_version: 1,
    kind: "private-managed-cleanup-entry",
    origin: "https://research.example.test",
    profileSha256: profile.document_sha256,
    connectionSha256: researchManagedCleanupConnectionIdentity(identity),
    privateConfigSha256: createHash("sha256").update(raw).digest("hex"),
    roleOid: 321,
    runtime,
  };
  const token = "a".repeat(64),
    url = `postgresql://${identity.role}:${"b".repeat(64)}@${identity.host}/${identity.database}?sslmode=verify-full&channel_binding=require`;
  return {
    deployment,
    raw,
    token,
    url,
    env: {
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_REGION: "lhr1",
      BETTER_AUTH_URL: deployment.origin,
      MAGICKLI_PRIVATE_RESEARCH_MANAGED_CLEANUP: "1",
      MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON: JSON.stringify(deployment),
      MAGICKLI_MANAGED_CLEANUP_PRIVATE_JSON: raw,
      MAGICKLI_MANAGED_CLEANUP_SECRET: token,
      MAGICKLI_MANAGED_CLEANUP_DATABASE_URL: url,
    },
  };
}
