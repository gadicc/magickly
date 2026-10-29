import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORGANIZATION,
  SITE_ORGANIZATION_ID,
  SITE_URL,
} from "./site";

/** The site's logo for search: the app's largest manifest icon. */
export const SITE_LOGO = {
  path: "/favicons/android-icon-192x192.png",
  width: 192,
  height: 192,
} as const;

/** The repository the site is built from: its one real profile. */
export const SITE_REPOSITORY = "https://github.com/gadicc/magickly";

/**
 * The home page's structured data (plan 062, A13), one graph: the site
 * (Google's site name), its publisher (Google's organization logo) and
 * the app as a whole, each with a stable `@id` the others point at.
 * Other pages name the publisher by the same `@id`. The app has no
 * rating, so Google shows no software-app rich result for it.
 */
export const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: "magick.ly",
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      publisher: { "@id": SITE_ORGANIZATION_ID },
    },
    {
      ...SITE_ORGANIZATION,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}${SITE_LOGO.path}`,
        width: SITE_LOGO.width,
        height: SITE_LOGO.height,
      },
      sameAs: [SITE_REPOSITORY],
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      // The site is reference first (correspondence tables, dictionaries,
      // the Tree, the rituals), with study tools beside it, as its own
      // description puts it: Google's ReferenceApplication.
      applicationCategory: "ReferenceApplication",
      operatingSystem: "Any",
      // Free; US dollars, as in Google's own examples.
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": SITE_ORGANIZATION_ID },
    },
  ],
};

/** Structured data as a script; `<` is escaped so no value can close it. */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped JSON, not HTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
