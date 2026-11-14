/** Default-disabled private retained-answer endpoint; no GET, model, upload or public listing. */
import { handleResearchRequest } from "@/chat-research/webServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleResearchRequest(request);
}
