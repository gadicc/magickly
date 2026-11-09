import { type NavLink, siteNav } from "@/app/siteNav";
import JsonLd from "./JsonLd";
import { SITE_NAME, SITE_URL } from "./site";

const HOME: NavLink = { title: SITE_NAME, url: "/" };

/**
 * The trail to a static page, from the same `pathnames.ts` entries as the
 * app bar's menu: the site, the sections above, the page. Null for a page
 * with nothing above it, where a trail would say nothing.
 */
export function pageTrail(path: string): NavLink[] | null {
  const nav = siteNav(path, null);
  if (!nav.known || nav.titleUrl || !nav.ancestors.length) return null;
  return [HOME, ...nav.ancestors, { title: nav.title, url: path }];
}

/**
 * The trail to an entity page (an angel, a Sephirah, a hall): its list
 * page's trail, then the entity under its short name, not its SEO title.
 */
export function entityTrail(
  listPath: string,
  name: string,
  path: string,
): NavLink[] {
  const list = pageTrail(listPath) ?? [
    HOME,
    { title: siteNav(listPath, null).title, url: listPath },
  ];
  return [...list, { title: name, url: path }];
}

/**
 * A `BreadcrumbList` node, for a page's own script or to splice into a
 * graph. Google wants a `name` on every item and an `item` URL on all but
 * the last; every item here has both.
 */
export function breadcrumbList(trail: NavLink[], siteUrl = SITE_URL) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.title,
      item: crumb.url === "/" ? siteUrl : siteUrl + crumb.url,
    })),
  };
}

/** A trail's structured data as its own script; nothing for no trail. */
export function Breadcrumbs({ trail }: { trail: NavLink[] | null }) {
  if (!trail) return null;
  return (
    <JsonLd
      data={{ "@context": "https://schema.org", ...breadcrumbList(trail) }}
    />
  );
}

/** The structured trail of a static page in `pathnames.ts`. */
export function PageBreadcrumbs({ path }: { path: string }) {
  return <Breadcrumbs trail={pageTrail(path)} />;
}
