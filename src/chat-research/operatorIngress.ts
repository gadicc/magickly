/** Pure deny-only surface filter for the separate owner-local listener. No auth or source/spending authority. */
import type { ResearchLocalDeployment } from "./localDeployment";
import {
  RESEARCH_API_PATH,
  RESEARCH_ARCHIVE_API_PATH,
  RESEARCH_CATALOG_API_PATH,
  RESEARCH_PAGE_PATH,
  RESEARCH_READ_API_PATH,
} from "./paths";
/** Called before handing a request to Next, including before normalization or action dispatch. null only permits further independently authorized processing. */
export function privateResearchOperatorRefusal(
  request: Pick<Request, "method" | "url" | "headers">,
  deployment: ResearchLocalDeployment,
): number | null {
  try {
    const url = new URL(request.url),
      expected = new URL(deployment.origin),
      h = request.headers;
    if (
      expected.origin !== deployment.origin ||
      expected.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(expected.hostname) ||
      !expected.port
    )
      return 503;
    if (
      url.origin !== deployment.origin ||
      h.get("host") !== expected.host ||
      h.has("next-action") ||
      h.has("authorization") ||
      h.get("sec-fetch-site") === "cross-site" ||
      (h.has("origin") && h.get("origin") !== deployment.origin)
    )
      return 403;
    for (const [key, value] of [
      ["x-forwarded-host", expected.host],
      ["x-forwarded-proto", "http"],
      ["x-forwarded-port", expected.port],
    ])
      if (h.has(key) && h.get(key) !== value) return 403;
    if (
      h.has("forwarded") ||
      h.has("expect") ||
      [...h.keys()].some((key) =>
        /^(?:x-middleware-|x-invoke-|x-nextjs-|x-now-route-matches$|x-matched-path$|next-url$|next-router-state-tree$)/.test(
          key,
        ),
      )
    )
      return 403;
    if (url.hash) return 404;
    if (["GET", "HEAD"].includes(request.method)) {
      if (
        url.pathname === RESEARCH_PAGE_PATH &&
        [...url.searchParams.keys()].every((key) => key === "_rsc") &&
        url.searchParams.getAll("_rsc").length <= 1 &&
        url.search.length <= 256
      )
        return null;
      if (
        !url.search &&
        /^\/_next\/static\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]+\.(?:js|css|woff2?)$/.test(
          url.pathname,
        ) &&
        !url.pathname.split("/").some((part) => part === "." || part === "..")
      )
        return null;
    }
    if (
      request.method === "POST" &&
      !url.search &&
      h.get("origin") === deployment.origin &&
      [
        RESEARCH_API_PATH,
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
