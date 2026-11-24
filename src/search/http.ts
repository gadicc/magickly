import { boundedText } from "@/lib/boundedText";
import { isSameOrigin } from "@/lib/sameOrigin";
import { refusalHeaders } from "@/limits/counters";
import type { SearchResult } from "./types";

/** Server dependencies allow the admission and failure boundaries to be tested. */
export interface SemanticSearchHttp {
  available(): Promise<boolean>;
  reserve(): Promise<{ allowed: boolean; resetAt: Date }>;
  search(query: string, signal: AbortSignal): Promise<SearchResult[]>;
}

/** The request's query, trimmed: 2 to 300 characters, in at most 4 KiB. */
async function readQuery(request: Request): Promise<string> {
  const raw = await boundedText(request, 4096);
  if (raw === undefined) throw new Error("Invalid input");
  const body: unknown = JSON.parse(raw);
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
  // Only the site's own pages may spend the allowance (`isSameOrigin`); a
  // request that says nothing of where it comes from is refused.
  if (!isSameOrigin(request))
    return reply({ message: "Search request rejected." }, 403);
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
        refusalHeaders(admission.resetAt),
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
