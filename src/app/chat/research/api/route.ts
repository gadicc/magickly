import { handleLocalResearchRequest } from "@/chat-research/localServer";
export const runtime = "nodejs";
/** Do not export the two-argument internal handler: Next's second argument is route context. */
export function POST(request: Request) {
  return handleLocalResearchRequest(request);
}
