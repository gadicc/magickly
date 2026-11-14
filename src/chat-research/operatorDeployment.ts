/** Separate opt-in pins for an independently adopted owner-local operator service. No secrets or authority are read here. */
import "server-only";
import { readResearchLocalDeployment } from "./localDeployment";
export const RESEARCH_OPERATOR_DEPLOYMENT_ERROR =
  "Private operator service unavailable";
/** Reuse the reviewed loopback/production-build restriction, never its startup pins or old-purpose opt-in. */
export function readResearchOperatorDeployment(
  env: Readonly<Record<string, string | undefined>>,
) {
  if (env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR !== "1") return null;
  try {
    if (env.MAGICKLI_PRIVATE_RESEARCH_LOCAL === "1") throw Error();
    return readResearchLocalDeployment({
      MAGICKLI_PRIVATE_RESEARCH_LOCAL: "1",
      NODE_ENV: env.NODE_ENV,
      CI: env.CI,
      VERCEL: env.VERCEL,
      VERCEL_ENV: env.VERCEL_ENV,
      VERCEL_URL: env.VERCEL_URL,
      VERCEL_REGION: env.VERCEL_REGION,
      BETTER_AUTH_URL: env.BETTER_AUTH_URL,
      MAGICKLI_RESEARCH_STARTUP_SHA256: env.MAGICKLI_OPERATOR_STARTUP_SHA256,
      MAGICKLI_RESEARCH_RUNTIME_SHA256: env.MAGICKLI_OPERATOR_RUNTIME_SHA256,
      MAGICKLI_RESEARCH_ENDPOINT_SHA256: env.MAGICKLI_OPERATOR_ENDPOINT_SHA256,
    });
  } catch {
    throw Error(RESEARCH_OPERATOR_DEPLOYMENT_ERROR);
  }
}
