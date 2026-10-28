/**
 * Permanent redirects for the temple halls' old URLs (plan 062's
 * amendment of 28 October 2026). `/gd/hall` was the editor with the
 * presets below it, and each hall's page and files lived under it; they
 * moved to `/gd/halls`. None of the old URLs was ever deployed, so these
 * are for bookmarks and copied links. A redirect's `Location` carries no
 * fragment, so the browser keeps the request's (RFC 9110, section
 * 10.2.2): `/gd/hall#preset=…` and `#hall=…` links reach the editor.
 *
 * `next.config.ts` imports this module, so it imports nothing.
 */
export const HALL_REDIRECTS = Object.freeze([
  { source: "/gd/hall", destination: "/gd/halls/editor", permanent: true },
  {
    source: "/gd/hall/:slug",
    destination: "/gd/halls/:slug",
    permanent: true,
  },
  {
    source: "/gd/hall/:slug/:file",
    destination: "/gd/halls/:slug/:file",
    permanent: true,
  },
] as const);
