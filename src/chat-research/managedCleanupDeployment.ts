/** Independent cleanup purpose. No environment, profile, credential, route or scheduler adoption on import. */
import "server-only";
import * as v from "valibot";
import { parseBoundedResearchJson } from "./boundedJson";
import { parseResearchManagedRuntime } from "./managedRetentionProfile";

const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const shape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("private-managed-cleanup-entry"),
  origin: v.string(),
  profileSha256: hash,
  connectionSha256: hash,
  privateConfigSha256: hash,
  roleOid: v.pipe(
    v.number(),
    v.safeInteger(),
    v.minValue(1),
    v.maxValue(4294967295),
  ),
  runtime: v.unknown(),
});
/** Independently adopted nonsecret release/target pins; data parsing cannot establish actual platform custody. */
export function readResearchManagedCleanupDeployment(
  env: Readonly<Record<string, string | undefined>>,
) {
  if (env.MAGICKLI_PRIVATE_RESEARCH_MANAGED_CLEANUP !== "1") return null;
  try {
    if (
      env.NODE_ENV !== "production" ||
      env.VERCEL !== "1" ||
      !["preview", "production"].includes(env.VERCEL_ENV!) ||
      env.VERCEL_REGION !== "lhr1" ||
      env.MAGICKLI_PRIVATE_RESEARCH_LOCAL === "1" ||
      env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR === "1"
    )
      throw Error();
    const raw = env.MAGICKLI_MANAGED_CLEANUP_DEPLOYMENT_JSON;
    if (typeof raw !== "string") throw Error();
    const d = v.parse(shape, parseBoundedResearchJson(raw, 8192)),
      u = new URL(d.origin),
      runtime = parseResearchManagedRuntime(d.runtime);
    if (
      u.origin !== d.origin ||
      u.protocol !== "https:" ||
      env.BETTER_AUTH_URL !== d.origin ||
      runtime.node_major !== 24
    )
      throw Error();
    return Object.freeze({ ...d, runtime });
  } catch {
    throw Error("Private cleanup unavailable");
  }
}
/** Cheap target/release metadata only. Secret values and private cleanup profile never enter the browser. */
export type ResearchManagedCleanupDeployment = NonNullable<
  ReturnType<typeof readResearchManagedCleanupDeployment>
>;
