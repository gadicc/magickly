/** Hosted-purpose opt-in only; these pins do not establish release, credential or source custody. */
import "server-only";
import * as v from "valibot";
import { isUuidV7 } from "../lib/ids";
import { parseBoundedResearchJson } from "./boundedJson";
export const RESEARCH_MANAGED_DEPLOYMENT_ERROR =
  "Private managed research unavailable";
const hash = v.pipe(v.string(), v.length(64), v.regex(/^[a-f0-9]{64}$/));
const oid = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(1),
  v.maxValue(4294967295),
);
const shape = v.strictObject({
  schema_version: v.literal(1),
  kind: v.literal("private-managed-main-site"),
  origin: v.string(),
  operatorId: v.pipe(
    v.string(),
    v.check((s) => isUuidV7(s) && s === s.toLowerCase()),
  ),
  startupSha256: hash,
  runtimeRevision: hash,
  authorityEndpointIdentity: hash,
  corpusEndpointIdentity: hash,
  privateConfigSha256: hash,
  database: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]{0,62}$/)),
  runtimeRoleOid: oid,
  readerRoleOid: oid,
  generation: v.picklist(["read-only", "native-window"]),
});
/** Cheap independently adopted server metadata. Never serialized into the browser shell. */
export type ResearchManagedDeployment = Readonly<v.InferInput<typeof shape>>;
/** Canonical owned descriptor projection. UI mode and caller key order cannot fork page/API startup identity. */
export function prepareResearchManagedDeployment(
  input: ResearchManagedDeployment,
): ResearchManagedDeployment {
  const value = Object.fromEntries(
    Object.keys(shape.entries).map((key) => [key, Reflect.get(input, key)]),
  );
  const parsed = v.parse(shape, value),
    u = new URL(parsed.origin);
  if (
    u.origin !== parsed.origin ||
    u.protocol !== "https:" ||
    parsed.runtimeRoleOid === parsed.readerRoleOid
  )
    throw Error(RESEARCH_MANAGED_DEPLOYMENT_ERROR);
  return Object.freeze(parsed);
}
/** Selected nonsecret settings only. Reading this never loads startup, corpus, credentials or provider keys. */
export function readResearchManagedDeployment(
  env: Readonly<Record<string, string | undefined>>,
): ResearchManagedDeployment | null {
  if (env.MAGICKLI_PRIVATE_RESEARCH_MANAGED !== "1") return null;
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
    const raw = env.MAGICKLI_MANAGED_DEPLOYMENT_JSON;
    if (typeof raw !== "string") throw Error();
    const deployment = v.parse(shape, parseBoundedResearchJson(raw, 8192)),
      url = new URL(deployment.origin);
    if (
      url.origin !== deployment.origin ||
      url.protocol !== "https:" ||
      env.BETTER_AUTH_URL !== deployment.origin ||
      deployment.runtimeRoleOid === deployment.readerRoleOid
    )
      throw Error();
    return prepareResearchManagedDeployment(deployment);
  } catch {
    throw Error(RESEARCH_MANAGED_DEPLOYMENT_ERROR);
  }
}
