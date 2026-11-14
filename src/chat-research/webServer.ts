/** Synchronous dispatch preserves the request snapshot before the first awaited startup. Legacy public chat never imports this entry. */
import "server-only";
import { handleLocalResearchRequest } from "./localServer";
import { handleOperatorResearchRequest } from "./operatorServer";
/** One argument only: Next's route context is not an ingress deadline. */
export function handleResearchRequest(request: Request) {
  return process.env.MAGICKLI_PRIVATE_RESEARCH_OPERATOR === "1"
    ? handleOperatorResearchRequest(request)
    : handleLocalResearchRequest(request);
}
