/** Default-disabled operator archive. No GET, arbitrary window, generation or history authority. */
import { handleLocalResearchRequest } from "@/chat-research/localServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleLocalResearchRequest(request);
}
