/** Public synthetic bindings only; no actual operator, endpoint, corpus or credential. */
import type { ResearchManagedDeployment } from "./managedDeployment";
export function managedDeploymentFixture(): ResearchManagedDeployment {
  return {
    schema_version: 1,
    kind: "private-managed-main-site",
    origin: "https://research.example.test",
    operatorId: "019aa111-0000-7000-8000-000000000001",
    startupSha256: "a".repeat(64),
    runtimeRevision: "b".repeat(64),
    authorityEndpointIdentity: "c".repeat(64),
    corpusEndpointIdentity: "d".repeat(64),
    privateConfigSha256: "e".repeat(64),
    database: "synthetic_db",
    runtimeRoleOid: 701,
    readerRoleOid: 702,
    generation: "native-window",
  };
}
export function managedDeploymentEnvironment() {
  const deployment = managedDeploymentFixture();
  return {
    MAGICKLI_PRIVATE_RESEARCH_MANAGED: "1",
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_REGION: "lhr1",
    BETTER_AUTH_URL: deployment.origin,
    MAGICKLI_MANAGED_DEPLOYMENT_JSON: JSON.stringify(deployment),
  };
}
