/** Default-disabled operator metadata read; no GET, model request or source resource. */
import { handleResearchRequest } from "@/chat-research/webServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleResearchRequest(request);
}
