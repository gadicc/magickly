import pathnames, { type Pathnames, type PathnameValue } from "./pathnames";

export const SITE_TITLE = "Magick.ly";

/**
 * The static 404 page's segment; the browser's router reports it without
 * the leading slash that the server-side pathname carries.
 */
export const NOT_FOUND_SEGMENT = "_not-found";

/** A titled page the bar's menu and the footer can link. */
export interface NavLink {
  title: string;
  url: string;
}

/** Where a path sits in the site, as the bar and the footer show it. */
export interface SiteNav {
  /** The page's title, or the site name when `known` is false. */
  title: string;
  /** False when the path has no title of its own. */
  known: boolean;
  /**
   * The sections above the page, outermost first, without Home. On a page
   * with no title of its own, the last is the section it sits in.
   */
  ancestors: NavLink[];
  /**
   * The other pages of the section the reader is in: a section page's
   * children, or a page's siblings. Never the page itself.
   */
  sectionPages: NavLink[];
  /**
   * True when `sectionPages` are the page's own children (a section page),
   * so they sit a level below it; false when they are its siblings.
   */
  childPages: boolean;
  /**
   * Set when the page sits below the entry that titles it, such as a
   * chapter under /books/la-science-cabalistique or a flashcard set under
   * /study: that entry's URL, which the menu links rather than marking it
   * as the current page.
   */
  titleUrl?: string;
  /** The first path segment, or "" on the home page and the 404. */
  topSection: string;
}

/**
 * Entries the bar's menu and the footer leave out: pages for signed-in
 * members, each linked from its own section page.
 */
const PRIVATE_KEYS = new Set(["admin", "deleted"]);

/**
 * Titles for dynamic routes. The static map cannot hold them, and its
 * entries are drawer links, which these pages must not become.
 */
const patternTitles: readonly [RegExp, PathnameValue][] = [
  [/^\/doc\/[^/]+\/edit\/semantic\/?$/, "Ritual editor"],
];

function titleOf(value: Pathnames | PathnameValue) {
  return typeof value === "object" ? value["/"] : value;
}

/** The pages directly below a section, each with its URL. */
function childrenOf(section: Pathnames, url: string): NavLink[] {
  return Object.entries(section)
    .filter(([key]) => key !== "/" && !PRIVATE_KEYS.has(key))
    .map(([key, value]) => ({
      title: titleOf(value),
      url: `${url === "/" ? "" : url}/${key}`,
    }));
}

/**
 * Resolves a path against `pathnames.ts`. `segment` is the root layout's
 * selected segment: the static 404 is prerendered once, at /_not-found,
 * and served for every unknown path, so its navigation must not depend on
 * the browser's path.
 */
export function siteNav(pathname: string, segment: string | null): SiteNav {
  const notFound = segment?.replace(/^\//, "") === NOT_FOUND_SEGMENT;
  const path = notFound ? `/${NOT_FOUND_SEGMENT}` : pathname;
  const none = { ancestors: [], sectionPages: [], childPages: false };

  const pattern = patternTitles.find(([match]) => match.test(path));
  if (pattern)
    return { ...none, title: pattern[1], known: true, topSection: "" };

  const parts = path.split("/").filter(Boolean);
  const ancestors: NavLink[] = [];
  let section: Pathnames = pathnames;
  let url = "";
  for (let i = 0; i < parts.length; i++) {
    // Own keys only, so that /constructor does not resolve to Object.
    const value = Object.hasOwn(section, parts[i])
      ? section[parts[i]]
      : undefined;
    const last = i === parts.length - 1;
    if (value === undefined) {
      // Below a titled section, with no title of its own: an entity page
      // such as /kabbalah/angel/<slug>, or an unknown path.
      return {
        title: SITE_TITLE,
        known: false,
        ancestors,
        sectionPages: ancestors.length ? childrenOf(section, url) : [],
        childPages: true,
        topSection: notFound ? "" : (parts[0] ?? ""),
      };
    }
    const childUrl = `${url}/${parts[i]}`;
    if (typeof value === "string" && !last) {
      // Below a titled entry: the entry names the page, as it always has.
      return {
        title: value,
        known: true,
        ancestors,
        sectionPages: ancestors.length
          ? childrenOf(section, url).filter((l) => l.url !== childUrl)
          : [],
        childPages: false,
        titleUrl: childUrl,
        topSection: parts[0],
      };
    }
    if (last) {
      const title = titleOf(value);
      return {
        title,
        known: true,
        ancestors,
        sectionPages:
          typeof value === "object"
            ? childrenOf(value, childUrl)
            : ancestors.length
              ? childrenOf(section, url).filter((l) => l.url !== childUrl)
              : [],
        childPages: typeof value === "object",
        topSection: parts[0],
      };
    }
    // A section on the way down.
    section = value as Pathnames;
    url = childUrl;
    ancestors.push({ title: section["/"], url });
  }
  return {
    ...none,
    title: titleOf(pathnames),
    known: true,
    topSection: "",
  };
}
