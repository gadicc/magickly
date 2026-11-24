/**
 * A request's body as UTF-8 text, read no further than `maxBytes`, so a large
 * body is never held in memory: undefined when there is no body, when it is
 * longer than that whatever its `Content-Length` says, when it is not valid
 * UTF-8, or when the client goes away while it is read.
 */
export async function boundedText(
  request: Request,
  maxBytes: number,
): Promise<string | undefined> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes || !request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return undefined;
      }
      chunks.push(value);
    }
    const all = new Uint8Array(bytes);
    let at = 0;
    for (const chunk of chunks) {
      all.set(chunk, at);
      at += chunk.byteLength;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(all);
  } catch {
    return undefined;
  }
}
