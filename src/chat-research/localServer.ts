/** Actual local-only application boundary, default disabled. No private or credential module imports on disabled/refused ingress. */
import "server-only";
import {
  RESEARCH_OPERATION_TIMEOUT_MS,
  withinResearchDeadline,
} from "./boundedWork";
import {
  type ResearchLocalDeployment,
  readResearchLocalDeployment,
} from "./localDeployment";
import {
  RESEARCH_API_PATH,
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_READ_API_PATH,
  RESEARCH_READ_BODY_BYTE_LIMIT,
} from "./paths";
import { RESEARCH_HTTP_BODY_BYTE_LIMIT } from "./request";

type Handler = (
  request: Request,
  inheritedIngressDeadlineAt?: number,
) => Promise<Response>;
let startup: { key: string; promise: Promise<Handler> } | undefined;
function service(deployment: ResearchLocalDeployment) {
  const key = JSON.stringify(deployment);
  if (startup) {
    if (startup.key !== key) throw Error();
    return startup.promise;
  }
  // Shared startup owns its own bound. One disconnected waiter cannot poison a good load.
  // A genuine load failure remains sticky until process restart; no automatic repair/retry.
  const end = performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
  const promise = withinResearchDeadline(
    new AbortController().signal,
    async (signal) => {
      const { bootstrapLocalResearch } = await import("./localBootstrap");
      signal.throwIfAborted();
      if (performance.now() >= end) throw Error();
      return bootstrapLocalResearch(deployment, signal, end);
    },
    end,
  );
  startup = { key, promise };
  return promise;
}
function cancel(request: Pick<Request, "body">) {
  try {
    if (request.body && !request.body.locked)
      void request.body.cancel().catch(() => {});
  } catch {}
}
function unavailable(status: number, request: Request) {
  cancel(request);
  return Response.json(
    { error: "Private research unavailable" },
    {
      status,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        vary: "Cookie",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}
const contentType = (value: string | null) =>
  value !== null &&
  /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(value.trim());
/** The Next route supplies exactly one argument. Original entry deadline only shortens startup/ingress, never provider work or independent settlement. */
export async function handleLocalResearchRequest(
  request: Request,
): Promise<Response> {
  const end = performance.now() + RESEARCH_OPERATION_TIMEOUT_MS;
  let owned = request,
    response: Response | undefined;
  try {
    // Request(existingRequest) proxies and eagerly pulls its body in Node. Bind
    // the captured stream directly; neither clone/tee nor a proxy may read it
    // during startup before the actual HTTP handler authenticates.
    const method = request.method,
      url = request.url,
      headers = new Headers(request.headers),
      originalSignal = request.signal,
      body = request.body;
    if (request.bodyUsed || body?.locked) return unavailable(400, request);
    const init: RequestInit & { duplex: "half" } = {
      method,
      headers,
      signal: originalSignal,
      body,
      duplex: "half",
    };
    owned = new Request(url, init);
    owned.signal.throwIfAborted();
    const deployment = readResearchLocalDeployment(process.env);
    if (!deployment) return unavailable(404, owned);
    const u = new URL(owned.url),
      expected = new URL(deployment.origin);
    if (owned.method !== "POST") return unavailable(405, owned);
    if (
      u.origin !== deployment.origin ||
      ![
        RESEARCH_API_PATH,
        RESEARCH_READ_API_PATH,
        RESEARCH_CATALOG_API_PATH,
        RESEARCH_ARCHIVE_API_PATH,
      ].includes(u.pathname) ||
      u.search ||
      u.hash ||
      headers.get("origin") !== deployment.origin ||
      headers.get("host") !== expected.host ||
      headers.get("sec-fetch-site") === "cross-site" ||
      ["x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"].some(
        (key) => {
          const value = headers.get(key);
          return (
            value !== null &&
            value !==
              (key === "x-forwarded-host"
                ? expected.host
                : key === "x-forwarded-proto"
                  ? expected.protocol.slice(0, -1)
                  : expected.port || "80")
          );
        },
      ) ||
      headers.has("forwarded")
    )
      return unavailable(403, owned);
    if (!contentType(headers.get("content-type")))
      return unavailable(415, owned);
    const length = headers.get("content-length");
    if (
      length !== null &&
      (!/^(0|[1-9][0-9]{0,8})$/.test(length) ||
        Number(length) >
          (u.pathname === RESEARCH_CATALOG_API_PATH ||
          u.pathname === RESEARCH_ARCHIVE_API_PATH
            ? 16
            : u.pathname === RESEARCH_READ_API_PATH
              ? RESEARCH_READ_BODY_BYTE_LIMIT
              : RESEARCH_HTTP_BODY_BYTE_LIMIT))
    )
      return unavailable(413, owned);
    const handler = await withinResearchDeadline(
      owned.signal,
      async (signal) => {
        const loaded = await service(deployment);
        signal.throwIfAborted();
        return loaded;
      },
      end,
    );
    owned.signal.throwIfAborted();
    if (performance.now() >= end) throw Error();
    // Crucially outside the short startup wait: genuine job/provider/settlement own their established lifetimes.
    response = await handler(owned, end);
    owned.signal.throwIfAborted();
    return response;
  } catch {
    if (response) cancel(response);
    return unavailable(503, owned);
  }
}
