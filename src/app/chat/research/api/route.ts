import { handleResearchRequest } from "@/chat-research/webServer";
export const runtime = "nodejs";
/** Do not export the two-argument internal handler: Next's second argument is route context. */
export function POST(request: Request) {
  return handleResearchRequest(request);
}
