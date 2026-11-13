/** Default-disabled private retained-answer endpoint; no GET, model, upload or public listing. */
import { handleLocalResearchRequest } from "@/chat-research/localServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleLocalResearchRequest(request);
}
