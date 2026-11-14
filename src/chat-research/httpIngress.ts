/** Shared private HTTP mechanics. Limits and parsers are fixed server configuration, never client capabilities. */
import "server-only";
import { parseBoundedResearchJson } from "./boundedJson";
import { withinResearchDeadline } from "./boundedWork";
export const RESEARCH_HTTP_ERROR = "Private research unavailable";
export class HttpFault extends Error {
  constructor(readonly status: number) {
    super(RESEARCH_HTTP_ERROR);
  }
}
export const fault = (status: number): never => {
  throw new HttpFault(status);
};
export function cancelBody(body: Request["body"]) {
  try {
    if (body && !body.locked) void body.cancel().catch(() => {});
  } catch {}
}
export function failure(status: number, body: Request["body"]) {
  cancelBody(body);
  return Response.json(
    { error: RESEARCH_HTTP_ERROR },
    {
      status,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        vary: "Cookie",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
export function origin(value: string) {
  const u = new URL(value);
  if (
    u.origin !== value ||
    !(
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    )
  )
    throw Error(RESEARCH_HTTP_ERROR);
  return value;
}
export function jsonContentType(value: string | null) {
  if (value === null) return false;
  const parts = value.split(";").map((s) => s.trim().toLowerCase());
  return (
    parts[0] === "application/json" &&
    parts.length <= 2 &&
    (parts.length === 1 || /^(charset=utf-8|charset="utf-8")$/.test(parts[1]))
  );
}
export async function readBody<T>(
  request: Request,
  body: Request["body"],
  headers: Headers,
  originalSignal: AbortSignal,
  ingressDeadline: number,
  parse: (value: unknown) => T,
  byteLimit: number,
  chunkLimit: number,
) {
  if (request.bodyUsed || body?.locked) fault(400);
  return withinResearchDeadline(
    originalSignal,
    async (signal) => {
      const assert = () => {
        signal.throwIfAborted();
        if (performance.now() >= ingressDeadline)
          throw Error(RESEARCH_HTTP_ERROR);
      };
      assert();
      const reader = body?.getReader();
      if (!reader) return fault(400);
      const chunks: Uint8Array[] = [],
        expected = headers.get("content-length");
      let bytes = 0;
      const stop = () => {
        try {
          void reader.cancel().catch(() => {});
        } catch {}
      };
      signal.addEventListener("abort", stop, { once: true });
      try {
        for (let n = 0; ; n++) {
          assert();
          const result = await reader.read();
          assert();
          if (result.done) break;
          if (
            n >= chunkLimit ||
            !(result.value instanceof Uint8Array) ||
            result.value.byteLength > byteLimit - bytes
          )
            fault(413);
          bytes += result.value.byteLength;
          chunks.push(Uint8Array.from(result.value));
        }
        if (expected !== null && bytes !== Number(expected)) fault(400);
        const data = new Uint8Array(bytes);
        let at = 0;
        for (const c of chunks) {
          data.set(c, at);
          at += c.byteLength;
        }
        let parsed: unknown;
        try {
          parsed = parseBoundedResearchJson(
            new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
              data,
            ),
            byteLimit,
          );
        } catch {
          return fault(400);
        }
        assert();
        let value: T;
        try {
          value = parse(parsed);
        } catch {
          return fault(400);
        }
        assert();
        return value;
      } finally {
        signal.removeEventListener("abort", stop);
        stop();
        try {
          reader.releaseLock();
        } catch {}
      }
    },
    ingressDeadline,
  );
}
