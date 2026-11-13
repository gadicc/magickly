/** Default-disabled operator metadata read; no GET, model request or source resource. */
import { handleLocalResearchRequest } from "@/chat-research/localServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleLocalResearchRequest(request);
}
