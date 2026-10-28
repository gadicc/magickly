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

/**
 * The site's old temple drawings, removed in plan 061's stage I, by the
 * hall each showed (Gadi, 28 October 2026). Each old URL redirects for
 * good to that hall's SVG, so a link, a search result or a ritual revision
 * that still cites one shows the hall as it is drawn now. Publication does
 * not follow redirects (it reads `public/` on disk), so a ritual still
 * holding one of these images cannot be published until it is edited.
 */
export const RETIRED_HALL_DRAWINGS = Object.freeze({
  "/pics/neophyte.svg": "neophyte",
  "/pics/zelator1.svg": "zelator-1",
  "/pics/zelator2.svg": "zelator-2",
  "/pics/theoricus1.svg": "theoricus-1",
  "/pics/theoricus2.svg": "theoricus-2",
} as const);

/** The redirects of the retired drawings, SVG to SVG. */
export const RETIRED_DRAWING_REDIRECTS = Object.freeze(
  Object.entries(RETIRED_HALL_DRAWINGS).map(([source, slug]) => ({
    source,
    destination: `/gd/halls/${slug}/golden-dawn-${slug}-temple.svg`,
    permanent: true as const,
  })),
);
