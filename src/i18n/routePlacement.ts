import { isPublishedLocalizedPath } from "./publications";

/** Document boundaries from plan 086, independent of indexing/access policy. */
export type DocumentRoot =
  | "public"
  | "localized"
  | "private"
  | "reader"
  | "offline"
  | "research";

/**
 * Explicit placement inventory. Indexed `/gd/rituals` is personalized but
 * keeps its public English URL; the offline shell must stay anonymous/static.
 * This records the migration target; it does not relocate any current route.
 */
export const ROUTE_PLACEMENT = {
  "/[locale]": "localized",
  "/[locale]/about": "localized",
  "/[locale]/books": "localized",
  "/about": "public",
  "/admin": "private",
  "/astrology/moon": "public",
  "/astrology": "public",
  "/astrology/planet/[id]": "public",
  "/astrology/planetary-hours": "public",
  "/astrology/planets": "public",
  "/astrology/zodiac": "public",
  "/books/la-science-cabalistique/[division]": "public",
  "/books/la-science-cabalistique": "public",
  "/books/la-science-cabalistique/texte-integral": "public",
  "/books": "public",
  "/chat": "public",
  "/chat/research": "research",
  "/chat/train": "private",
  "/doc/[_id]/edit": "private",
  "/doc/[_id]/edit/semantic": "private",
  "/doc/[_id]": "reader",
  "/doc/neophyte": "public",
  "/doc/theoricus": "public",
  "/doc/zelator": "public",
  "/enochian/dictionary": "public",
  "/enochian/keys": "public",
  "/enochian/oration": "public",
  "/enochian": "public",
  "/enochian/tablets": "public",
  "/enochian/translate": "public",
  "/gd/components": "public",
  "/gd/grade/[id]": "public",
  "/gd/grades": "public",
  "/gd/halls/[slug]": "public",
  "/gd/halls/editor": "public",
  "/gd/halls": "public",
  "/gd": "public",
  "/gd/rituals/deleted": "private",
  "/gd/rituals": "public",
  "/gd/sigils": "public",
  "/gd/symbols/candlestick": "public",
  "/gd/symbols/fylfot-cross": "public",
  "/gd/symbols": "public",
  "/gd/symbols/shewbread": "public",
  "/geomancy": "public",
  "/geomancy/reading": "public",
  "/geomancy/reference": "public",
  "/help/ritual-pug": "public",
  "/help/temples": "public",
  "/kabbalah/angel/[slug]": "public",
  "/kabbalah": "public",
  "/kabbalah/path/[id]": "public",
  "/kabbalah/sephirah/[id]": "public",
  "/kabbalah/tree": "public",
  "/kabbalah/yhvh/72angels": "public",
  "/kabbalah/yhvh": "public",
  "/offline/ritual": "offline",
  "/open-source/components/[name]": "public",
  "/open-source/components": "public",
  "/open-source/data/[table]": "public",
  "/open-source/data": "public",
  "/open-source": "public",
  "/": "public",
  "/signin": "private",
  "/study/[_id]": "private",
  "/study/info/[_id]": "private",
  "/study": "public",
  "/temples/admin/[_id]/membership/[membershipId]": "private",
  "/temples/admin/[_id]": "private",
  "/temples/admin": "private",
  "/temples/join/[slug]/[pass]": "private",
  "/temples": "private",
  "/upload": "private",
} as const satisfies Record<string, DocumentRoot>;

const dynamicRoutes = Object.entries(ROUTE_PLACEMENT)
  .filter(([route, root]) => route.includes("[") && root !== "localized")
  .map(([route, root]) => ({
    root,
    pattern: new RegExp(`^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`),
  }));

/** Physical page entry below src/app; route groups never enter the public URL. */
export function pageSourceForRoute(route: string): string | null {
  if (!Object.hasOwn(ROUTE_PLACEMENT, route)) return null;
  const root = ROUTE_PLACEMENT[route as keyof typeof ROUTE_PLACEMENT];
  return `(${root})${route === "/" ? "" : route}/page.tsx`;
}

/**
 * The document boundary for an unprefixed page pathname, or null for unknown
 * and technical URLs. This is navigation policy, never access authorization.
 * Exact bundled ritual routes take precedence over the dynamic reader.
 */
export function documentRootForPath(pathname: string): DocumentRoot | null {
  if (
    !pathname.startsWith("/") ||
    /[?#\\]/.test(pathname) ||
    pathname.includes("//")
  )
    return null;
  const path = pathname.replace(/\/$/, "") || "/";
  if (isPublishedLocalizedPath(path)) return "localized";
  if (Object.hasOwn(ROUTE_PLACEMENT, path))
    return ROUTE_PLACEMENT[path as keyof typeof ROUTE_PLACEMENT];
  return dynamicRoutes.find(({ pattern }) => pattern.test(path))?.root ?? null;
}
