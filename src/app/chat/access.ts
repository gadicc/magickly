import { getCurrentSqlUserId } from "@/auth/session";
import { reserveDailyChatUsage } from "./usage";

/** Read identity on the server; anonymous callers all share the same allowance. */
export async function admitChat() {
  return reserveDailyChatUsage(await getCurrentSqlUserId());
}
