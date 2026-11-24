import { getCurrentSqlUserId } from "@/auth/session";
import { CHAT_CLIENT } from "@/limits/policies";
import { requestClientSubject } from "@/limits/request";
import { reserveDailyChatUsage } from "./usage";

/**
 * Read identity on the server: a signed-in reader uses their own allowance;
 * a signed-out one their client's share of the anonymous pool.
 */
export async function admitChat(request: Request) {
  const now = new Date();
  return reserveDailyChatUsage(
    {
      userId: await getCurrentSqlUserId(),
      client: () => requestClientSubject(request, CHAT_CLIENT, now),
    },
    now,
  );
}
