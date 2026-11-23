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
 * A rewrite for next.config.ts: any name under an angel's page that ends in
 * `.rsc`, to the 404. Next strips that suffix from the URL a proxy is given
 * (`normalizeRscURL` in its adapter, whatever `skipProxyUrlNormalize` says),
 * so `<file>.png.rsc` passes the proxy as `<file>.png` and would reach the
 * route as a name it does not know. A config rewrite sees the path as asked.
 */
export const ANGEL_SIGIL_RSC_REWRITE = {
  source: "/kabbalah/angel/:slug/:file(.+\\.rsc)",
  destination: ANGEL_SIGIL_NOT_FOUND_PATH,
} as const;

let known: ReadonlySet<string> | undefined;

/**
 * Whether a path is one of the 576 files (72 angels, four styles, PNG and
 * SVG): `/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.png`. Exact
 * and case-sensitive, as the route's lookup is; anything percent-encoded is
 * refused, since no file's name needs it.
 */
export function isAngelSigilFilePath(pathname: string): boolean {
  known ??= new Set(
    ANGEL_SIGIL_SLUGS.flatMap((slug) =>
      ANGEL_SIGIL_STYLES.flatMap((style) =>
        ["png", "svg"].map(
          (format) =>
            `/kabbalah/angel/${slug}/${angelSigilFileBase(slug, style)}.${format}`,
        ),
      ),
    ),
  );
  return known.has(pathname);
}
