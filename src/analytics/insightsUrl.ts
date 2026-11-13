/**
 * Which paths Vercel Web Analytics and Speed Insights may see.
 *
 * Public reference pages report their path. Anything else can name a
 * private ritual, a temple or a membership, and a temple invite carries
 * its password in the path (`/temples/join/<slug>/<pass>`), so those report
 * only their first segment, and unknown or odd paths report `/*`. The same
 * string serves as the page's route, so Next's own route pattern, which
 * keeps a segment it fails to match, is never computed. Query strings and
 * fragments are never sent.
 */

/** Sections whose every path is public reference content. */
export const PUBLIC_SECTIONS = new Set([
  "about",
  "astrology",
  "books",
  "chat",
  "enochian",
  "gd",
  "geomancy",
  "help",
  "kabbalah",
  "open-source",
]);

/** Public pages in sections that also hold private ones. */
const PUBLIC_PATHS = new Set([
  "/",
  "/study",
  "/doc/neophyte",
  "/doc/theoricus",
  "/doc/zelator",
]);

/** The app's other top-level sections, reported by name alone. */
export const PRIVATE_SECTIONS = new Set([
  "admin",
  "doc",
  "img",
  "offline",
  "og",
  "signin",
  "study",
  "temples",
  "upload",
]);

/** Encoded slashes or backslashes could hide a deeper path in one segment. */
const ENCODED_SEPARATOR = /%2f|%5c|\\/i;

/** Whether a pathname is a public page that may be reported in full. */
export function isPublicPath(pathname: string): boolean {
  if (ENCODED_SEPARATOR.test(pathname)) return false;
  if (PUBLIC_PATHS.has(pathname)) return true;
  const section = pathname.split("/")[1];
  return section !== undefined && PUBLIC_SECTIONS.has(section);
}

/**
 * The path to report for a pathname: a public page's own path, another
 * section's name (`/temples/*`), or `/*`.
 */
export function insightsPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (isPublicPath(path)) return path;
  const [, section = "", ...rest] = path.split("/");
  if (ENCODED_SEPARATOR.test(path) || !PRIVATE_SECTIONS.has(section))
    return "/*";
  return `/${section}${rest.length ? "/*" : ""}`;
}

/**
 * `insightsPath` applied to a full URL, keeping its origin. Null when the
 * URL does not parse, so nothing is sent.
 */
export function insightsUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.origin + insightsPath(parsed.pathname);
  } catch {
    return null;
  }
}
