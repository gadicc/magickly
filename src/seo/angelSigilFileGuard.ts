import {
  ANGEL_SIGIL_SLUGS,
  ANGEL_SIGIL_STYLES,
  angelSigilFileBase,
} from "../render/contracts/angelSigil";

/*
 * Which paths under an angel's page name one of its sigil files (plan 096,
 * decision 3), for `src/proxy.ts`. The bare and talisman files are drawn on
 * their first request and kept, so a made-up name must never reach the
 * route: a 404 the route returned would be kept like any first response.
 * Only the contract's written lists are read, never the data, so the proxy's
 * bundle stays small.
 */

/** Where the proxy sends any other name: a path no route matches. */
export const ANGEL_SIGIL_NOT_FOUND_PATH = "/kabbalah/angel/_/_/not-found";

/**
 * A rewrite for next.config.ts: a name under an angel's page that ends in
 * `.rsc`, to the 404. Next strips that suffix from the URL a proxy is given
 * (`normalizeRscURL` in its adapter, whatever `skipProxyUrlNormalize` says),
 * so `<file>.png.rsc` passes the proxy as `<file>.png` and would reach the
 * route as a name it does not know. A config rewrite sees the path as asked.
 * Only an angel's slug (no dot) and one segment: the angel page's own
 * prerendered segments, `<slug>.segments/_tree.segment.rsc` and the deeper
 * `__PAGE__` one, are left alone.
 */
export const ANGEL_SIGIL_RSC_REWRITE = {
  source: "/kabbalah/angel/:slug([^/.]+)/:file([^/]+\\.rsc)",
  destination: ANGEL_SIGIL_NOT_FOUND_PATH,
} as const;

/**
 * The request headers of Next's router fetching a page's RSC payload, which
 * the proxy sees only because `skipProxyUrlNormalize` is set. On Vercel a
 * request with `RSC: 1` gets `.rsc` appended after the proxy and the config
 * rewrites have run, so it may reach the route as `<file>.png.rsc`, an
 * unknown name whose 404 would be kept.
 */
const FLIGHT_REQUEST_HEADERS = [
  "rsc",
  "next-router-prefetch",
  "next-router-segment-prefetch",
] as const;

/** Whether a request is Next's router asking for an RSC payload. */
export function isFlightRequest(headers: Headers): boolean {
  return FLIGHT_REQUEST_HEADERS.some((name) => headers.has(name));
}

/**
 * The segments the angel page is prerendered as (`.next/server/app/kabbalah/
 * angel/<slug>.segments/`), held to a build's own by
 * scripts/checkProxyBuild.mts. Next's router asks for them with headers, on
 * the page's own URL, which the proxy never matches; only a request for one
 * by its path reaches the proxy, `.rsc` already stripped.
 */
export const ANGEL_PAGE_SEGMENTS = ["_tree", "_full", "!KHB1YmxpYyk"] as const;

let known: ReadonlySet<string> | undefined;
let segments: ReadonlySet<string> | undefined;

/** The 576 files' paths (72 angels, four styles, PNG and SVG). */
export function angelSigilFilePaths(): string[] {
  return ANGEL_SIGIL_SLUGS.flatMap((slug) =>
    ANGEL_SIGIL_STYLES.flatMap((style) =>
      ["png", "svg"].map(
        (format) =>
          `/kabbalah/angel/${slug}/${angelSigilFileBase(slug, style)}.${format}`,
      ),
    ),
  );
}

/**
 * Whether a path is one of the 576 files (72 angels, four styles, PNG and
 * SVG): `/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.png`. Exact
 * and case-sensitive, as the route's lookup is; anything percent-encoded is
 * refused, since no file's name needs it.
 */
export function isAngelSigilFilePath(pathname: string): boolean {
  known ??= new Set(angelSigilFilePaths());
  return known.has(pathname);
}

/**
 * Whether a path is one of the angel page's prerendered segments as the
 * proxy sees it, `.rsc` stripped: `/kabbalah/angel/vehuiah.segments/_tree.segment`.
 * Exact, so that no made-up name passes as one.
 */
export function isAngelPageSegmentPath(pathname: string): boolean {
  segments ??= new Set(
    ANGEL_SIGIL_SLUGS.flatMap((slug) =>
      ANGEL_PAGE_SEGMENTS.map(
        (segment) => `/kabbalah/angel/${slug}.segments/${segment}.segment`,
      ),
    ),
  );
  return segments.has(pathname);
}
