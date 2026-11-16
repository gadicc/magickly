/** New hosted purpose only; lazy bootstrap never uses the local launch/root contracts. */
import "server-only";
import { readResearchManagedDeployment } from "./managedDeployment";
import { createResearchServerIngress } from "./serverIngress";
export const handleManagedResearchRequest = createResearchServerIngress({
  readDeployment: readResearchManagedDeployment,
  loadBootstrap: async () =>
    (await import("./managedBootstrap")).bootstrapManagedResearch,
});
