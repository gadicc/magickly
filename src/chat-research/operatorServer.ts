/** New-purpose operator ingress only; old reader pins cannot activate it. */
import "server-only";
import { readResearchOperatorDeployment } from "./operatorDeployment";
import { createResearchServerIngress } from "./serverIngress";
export const handleOperatorResearchRequest = createResearchServerIngress({
  readDeployment: readResearchOperatorDeployment,
  loadBootstrap: async () =>
    (await import("./operatorBootstrap")).bootstrapOperatorResearch,
});
