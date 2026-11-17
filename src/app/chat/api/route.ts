import { isSameOrigin } from "@/lib/sameOrigin";
import { admitChat } from "../access";
import { chatDependencies } from "../providers";
import { respondToChat } from "../server";

export const runtime = "nodejs";

/** Retain the plaintext protocol for clients cached before the AI SDK upgrade. */
export function POST(request: Request) {
  // Another site's page must not spend a reader's allowance (plan 081, S5).
  if (!isSameOrigin(request))
    return Response.json({ message: "Forbidden" }, { status: 403 });
  return respondToChat(request, "legacy", chatDependencies, admitChat);
}
