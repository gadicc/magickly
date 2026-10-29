/** Production origin. Preview deployments also point canonicals here. */
export const SITE_URL = "https://magick.ly";

export const SITE_NAME = "Magick.ly";

/** The site's `Organization` node, defined in full on the home page. */
export const SITE_ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * The site as an `Organization` where another page names it (the hall
 * images' creator, the hall editor's publisher): its `@id`, which points
 * at the home page's full node, with its type, name and URL inline, since
 * Google reads each page on its own and does not follow an `@id` to
 * another page.
 */
export const SITE_ORGANIZATION = {
  "@type": "Organization",
  "@id": SITE_ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
} as const;

export const SITE_TITLE = `${SITE_NAME}: Open Source Magick Reference and Tools`;

export const SITE_DESCRIPTION =
  "Free, open source reference and tools for Western esoteric study: Kabbalah, " +
  "the Golden Dawn, Enochian magick, astrology, geomancy and flashcards.";

/**
 * Open Graph fields every page shares. Next replaces a parent's `openGraph`
 * object when a page sets its own, so page metadata spreads this first.
 */
export const SITE_OPEN_GRAPH = {
  type: "website",
  siteName: SITE_NAME,
} as const;
