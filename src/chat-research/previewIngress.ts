/** Private reader surface only. This does not authenticate or replace per-read source/native authorization. */
import { readResearchLocalDeployment } from "./localDeployment";
import {
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_PAGE_PATH,
  RESEARCH_READ_API_PATH,
} from "./paths";
/** null preserves ordinary site behavior; a status refuses before rendering/actions. */
export function privateResearchPreviewRefusal(
  request: Request,
  env: Readonly<Record<string, string | undefined>>,
): number | null {
  if (env.MAGICKLI_PRIVATE_RESEARCH_LOCAL !== "1") return null;
  try {
    const deployment = readResearchLocalDeployment(env),
      url = new URL(request.url),
      h = request.headers;
    if (deployment?.origin !== "http://localhost:4180") return 503;
    if (
      h.get("host") !== "localhost:4180" ||
      h.has("next-action") ||
      h.has("authorization") ||
      h.get("sec-fetch-site") === "cross-site" ||
      (h.has("origin") && h.get("origin") !== deployment.origin)
    )
      return 403;
    // Next adds its own forwarded values. Accept only the fixed bound listener's values, never an alternate proxy destination.
    for (const [key, value] of [
      ["x-forwarded-host", "localhost:4180"],
      ["x-forwarded-proto", "http"],
      ["x-forwarded-port", "4180"],
    ])
      if (h.has(key) && h.get(key) !== value) return 403;
    if (h.has("forwarded")) return 403;
    if (["GET", "HEAD"].includes(request.method)) {
      if (url.pathname === RESEARCH_PAGE_PATH) return null;
      if (
        /^\/_next\/static\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]+\.(?:js|css|woff2?)$/.test(
          url.pathname,
        ) &&
        !url.pathname.split("/").some((p) => p === "." || p === "..")
      )
        return null;
    }
    if (
      request.method === "POST" &&
      !url.search &&
      [
        RESEARCH_ARCHIVE_API_PATH,
        RESEARCH_CATALOG_API_PATH,
        RESEARCH_READ_API_PATH,
      ].includes(url.pathname)
    )
      return null;
    return 404;
  } catch {
    return 503;
  }
}
