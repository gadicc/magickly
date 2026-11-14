/** Existing archive-only entry, kept separate from operator question service startup. */
import "server-only";
import { readResearchLocalDeployment } from "./localDeployment";
import { createResearchServerIngress } from "./serverIngress";
export const handleLocalResearchRequest = createResearchServerIngress({
  readDeployment: readResearchLocalDeployment,
  loadBootstrap: async () =>
    (await import("./localBootstrap")).bootstrapLocalResearch,
});
