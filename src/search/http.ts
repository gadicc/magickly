import type { SearchResult } from "./types";

/** Server dependencies allow the admission and failure boundaries to be tested. */
export interface SemanticSearchHttp {
  available(): Promise<boolean>;
  reserve(): Promise<{ allowed: boolean; resetAt: Date }>;
  search(query: string, signal: AbortSignal): Promise<SearchResult[]>;
}

async function readQuery(request: Request): Promise<string> {
  if (!request.body) throw new Error("Invalid input");
  const reader = request.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) {
        await reader.cancel();
        throw new Error("Invalid input");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (
    !body ||
    typeof body !== "object" ||
    !("query" in body) ||
    typeof body.query !== "string"
  )
    throw new Error("Invalid input");
  const query = body.query.trim();
  if (query.length < 2 || query.length > 300) throw new Error("Invalid input");
  return query;
}

/** Only one bounded embedding call; lexical search always remains independent. */
export async function respondToSemanticSearch(
  request: Request,
  dependencies: SemanticSearchHttp,
): Promise<Response> {
  const reply = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "no-store", ...headers },
    });
  const origin = request.headers.get("origin");
  if (origin) {
    // Next may construct request.url with an internal hostname. The Host
    // header is the browser's actual request target; do not trust a caller's
    // arbitrary x-forwarded-host value for this check.
    const host = request.headers.get("host") ?? new URL(request.url).host;
    let allowed = false;
    try {
      const parsed = new URL(origin);
      allowed =
        ["http:", "https:"].includes(parsed.protocol) &&
        parsed.origin === origin &&
        parsed.host.toLowerCase() === host.toLowerCase();
    } catch {
      /* Opaque and malformed origins are rejected. */
    }
    if (!allowed) return reply({ message: "Search request rejected." }, 403);
  }
  let query: string;
  try {
    query = await readQuery(request);
  } catch {
    return reply({ message: "Enter between 2 and 300 characters." }, 400);
  }
  try {
    request.signal.throwIfAborted();
    if (!(await dependencies.available()))
      return reply(
        {
          message:
            "Search by meaning is unavailable. Text results are still shown.",
        },
        503,
      );
    const admission = await dependencies.reserve();
    if (!admission.allowed)
      return reply(
        {
          message:
            "Search by meaning has reached today's limit. Text results are still shown.",
        },
        429,
        { "Retry-After": admission.resetAt.toUTCString() },
      );
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(15_000),
    ]);
    const results = await dependencies.search(query, signal);
    return reply({ query, results });
  } catch {
    return reply(
      {
        message:
          "Search by meaning could not finish. Text results are still shown.",
      },
      503,
    );
  }
}
