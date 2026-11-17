/** Inactive unless cleanup is independently configured; no schedule is registered here. */
import { handleManagedResearchCleanup } from "@/chat-research/managedCleanupServer";
export const runtime = "nodejs";
export const maxDuration = 60;
export function GET(request: Request) {
  return handleManagedResearchCleanup(request);
}
