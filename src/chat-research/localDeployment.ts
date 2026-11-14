/** Cheap server-only opt-in settings. This gate creates no consent, identity, grant or allowance. */
import "server-only";
export const RESEARCH_LOCAL_DEPLOYMENT_ERROR =
  "Private research startup unavailable";
const hash = /^[a-f0-9]{64}$(?![\s\S])/;
/** Independently reviewed outer pins, separate from the frozen cleanup worker. */
export interface ResearchLocalDeployment {
  readonly origin: string;
  readonly startupSha256: string;
  readonly runtimeRevision: string;
  readonly authorityEndpointIdentity: string;
}
/** Read only selected nonsecret settings. The reviewed outer launcher must bind next start to loopback without an untrusted proxy. */
export function readResearchLocalDeployment(
  env: Readonly<Record<string, string | undefined>>,
): ResearchLocalDeployment | null {
  if (env.MAGICKLI_PRIVATE_RESEARCH_LOCAL !== "1") return null;
  try {
    if (
      env.NODE_ENV !== "production" ||
      ["VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION", "CI"].some(
        (key) => env[key] !== undefined,
      )
    )
      throw Error();
    const origin = env.BETTER_AUTH_URL!,
      u = new URL(origin),
      startupSha256 = env.MAGICKLI_RESEARCH_STARTUP_SHA256!,
      runtimeRevision = env.MAGICKLI_RESEARCH_RUNTIME_SHA256!,
      authorityEndpointIdentity = env.MAGICKLI_RESEARCH_ENDPOINT_SHA256!;
    if (
      u.origin !== origin ||
      u.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
      ![startupSha256, runtimeRevision, authorityEndpointIdentity].every(
        (value) => typeof value === "string" && hash.test(value),
      )
    )
      throw Error();
    return Object.freeze({
      origin,
      startupSha256,
      runtimeRevision,
      authorityEndpointIdentity,
    });
  } catch {
    throw Error(RESEARCH_LOCAL_DEPLOYMENT_ERROR);
  }
}
