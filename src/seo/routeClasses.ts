/**
 * How each page route is classed for search: public pages are the keys of
 * `PUBLIC_PAGES`; these are the rest. `routes.test.ts` checks that every
 * route in `src/app` is classed once, and the footer's test uses the same
 * lists.
 */

/** Dynamic routes whose `generateMetadata` decides per row. */
export const ENTITY_ROUTES = [
  "/kabbalah/angel/[slug]",
  "/books/la-science-cabalistique/[division]",
  "/astrology/planet/[id]",
  "/doc/[_id]",
  "/gd/grade/[id]",
  "/gd/halls/[slug]",
  "/kabbalah/path/[id]",
  "/kabbalah/sephirah/[id]",
  // Not indexed for now, and out of the sitemap and site search: a whole
  // table would compete with the pages that present its rows (plan 080,
  // decision 4).
  "/open-source/data/[table]",
  "/open-source/components/[name]",
];

/** Account, administration, offline and test pages: `noindex`. */
export const PRIVATE_ROUTES = [
  // Not private, but deliberately not indexed: a duplicate of the eleven
  // chapter routes, kept for find-in-page and printing. See plan 033.
  "/books/la-science-cabalistique/texte-integral",
  "/admin",
  "/chat/train",
  "/doc/[_id]/edit",
  "/doc/[_id]/edit/semantic",
  "/gd/components",
  "/gd/rituals/deleted",
  "/offline/ritual",
  "/signin",
  "/study/[_id]",
  "/study/info/[_id]",
  "/temples",
  "/temples/admin",
  "/temples/admin/[_id]",
  "/temples/admin/[_id]/membership/[membershipId]",
  "/temples/join/[slug]/[pass]",
  "/upload",
];
