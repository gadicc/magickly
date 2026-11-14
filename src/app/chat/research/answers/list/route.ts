/** Default-disabled operator archive. No GET, arbitrary window, generation or history authority. */
import { handleResearchRequest } from "@/chat-research/webServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handleResearchRequest(request);
}
