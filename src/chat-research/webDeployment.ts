/** Reader and generation are separate purposes; simultaneous activation is refused. */
import "server-only";
import { readResearchLocalDeployment } from "./localDeployment";
import { readResearchManagedDeployment } from "./managedDeployment";
import { readResearchOperatorDeployment } from "./operatorDeployment";
/** Request-time UI hint only, never source or spending authority. */
export function readResearchWebDeployment(
  env: Readonly<Record<string, string | undefined>>,
) {
  if (env.MAGICKLI_PRIVATE_RESEARCH_MANAGED === "1") {
    const deployment = readResearchManagedDeployment(env);
    return deployment ? { mode: "managed" as const, ...deployment } : null;
  }
  if (env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR === "1") {
    const deployment = readResearchOperatorDeployment(env);
    return deployment ? { mode: "operator" as const, ...deployment } : null;
  }
  const deployment = readResearchLocalDeployment(env);
  return deployment ? { mode: "reader" as const, ...deployment } : null;
}
