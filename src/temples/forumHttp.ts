/** Every request to a temple's forum is bounded: it is someone else's server. */
export const FORUM_REQUEST_TIMEOUT_MS = 15_000;
/** A whole sync stops after this long, whatever the forum does. */
export const FORUM_SYNC_DEADLINE_MS = 4 * 60_000;
export const FORUM_RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024;

/** Fresh fetch options for one request: no redirects, a timer of its own. */
export function forumFetchOptions() {
  return {
    redirect: "error" as const,
    cache: "no-store" as const,
    signal: AbortSignal.timeout(FORUM_REQUEST_TIMEOUT_MS),
  };
}

/** The body as text, refusing to read more than `limit` bytes. */
export async function readCappedText(
  response: Response,
  limit = FORUM_RESPONSE_LIMIT_BYTES,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("The forum's response was too large.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
