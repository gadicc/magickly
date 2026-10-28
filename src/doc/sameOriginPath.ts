/** Any origin will do: only whether a path keeps it matters. */
const BASE = "https://x.invalid";

/**
 * Whether `href` is a path on this site: one leading slash, then nothing a
 * browser would read as another host. URL parsing drops tabs, newlines
 * and carriage returns and reads a backslash as a slash, so `/\t/host`
 * or `/\host` would otherwise leave the site; controls, spaces, DEL and
 * backslashes are refused outright, and the resolved origin must be the
 * base's. Percent-encoded slashes (`/%2f/host`) stay paths. The same
 * answer on the server and in the browser, so rendering hydrates.
 */
export function sameOriginPath(href: unknown): href is string {
  if (
    typeof href !== "string" ||
    !/^\/(?![/\\])/.test(href) ||
    /[\u0000- \u007f\\]/.test(href)
  )
    return false;
  // A path relative to a valid base always parses.
  return new URL(href, BASE).origin === BASE;
}
