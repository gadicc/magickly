import { SITE_REPOSITORY } from "@/seo/site";
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
  /** The path resolved: the browser's, or `/_not-found` on the 404. */
  path: string;
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
    return { ...none, title: pattern[1], known: true, topSection: "", path };

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
        path,
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
        path,
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
        path,
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
    path,
  };
}

/** A section as the footer lists it: its page, then its pages. */
export interface FooterSection extends NavLink {
  pages: NavLink[];
}

/** The footer's sections, in the order readers look for them. */
const FOOTER_SECTIONS = [
  "kabbalah",
  "gd",
  "enochian",
  "astrology",
  "geomancy",
  "books",
  "open-source",
] as const;

/** Links a section's footer column adds after its own pages. */
const FOOTER_EXTRAS: Partial<
  Record<(typeof FOOTER_SECTIONS)[number], NavLink[]>
> = {
  "open-source": [{ title: "Source code", url: SITE_REPOSITORY }],
};

/** Every public section and its pages, from `pathnames.ts`. */
export function footerSections(): FooterSection[] {
  return FOOTER_SECTIONS.map((key) => {
    const section = pathnames[key] as Pathnames;
    const url = `/${key}`;
    return {
      title: section["/"],
      url,
      pages: [...childrenOf(section, url), ...(FOOTER_EXTRAS[key] ?? [])],
    };
  });
}

/**
 * Where the footer stays out: full-screen screens (the ritual readers and
 * editors, the hall editor, chat, flashcards), offline pages, and the
 * members', account and admin pages, which search does not see. Tested
 * against every route in `src/app`.
 */
const NO_FOOTER = [
  /^\/doc(\/|$)/,
  /^\/offline(\/|$)/,
  /^\/chat(\/|$)/,
  /^\/gd\/halls\/editor\/?$/,
  /^\/gd\/components\/?$/,
  /^\/gd\/rituals\/deleted\/?$/,
  /^\/study\/.+/,
  /^\/temples(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/upload\/?$/,
  /^\/signin\/?$/,
];

/** Whether a path shows the site footer. */
export function showsFooter(pathname: string) {
  return !NO_FOOTER.some((pattern) => pattern.test(pathname));
}
