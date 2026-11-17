import { localizedPath, type UiLocale } from "./locales";

/** Only complete public translations belong here. A UI catalog grants no public edition. */
export const PUBLIC_TRANSLATIONS = {
  "/": { he: "/he" },
  "/about": { he: "/he/about" },
  "/books": { he: "/he/books" },
} as const;

/** Return a real canonical edition, or null rather than an English clone. */
export function publicEdition(path: string, locale: UiLocale): string | null {
  if (!path.startsWith("/") || path.startsWith("//"))
    return locale === "en" ? path : null;
  const [, pathname, suffix] = /^([^?#]*)(.*)$/.exec(path)!;
  const logical = localizedPath(pathname).path.replace(/\/+$/, "") || "/";
  const edition =
    locale === "en" ? logical : PUBLIC_TRANSLATIONS[logical]?.[locale];
  return edition ? edition + suffix : null;
}

/** Enable only after the final translation, routing and SEO acceptance review. */
export const LOCALIZED_SEO_ENABLED = false;

/** Available routes and indexable routes are intentionally separate during rollout. */
export function indexableLocalizedPaths(): string[] {
  return LOCALIZED_SEO_ENABLED
    ? Object.values(PUBLIC_TRANSLATIONS).flatMap((editions) =>
        Object.values(editions),
      )
    : [];
}

/** Search alternates are withheld until the final SEO launch. */
export function publicAlternates(
  path: string,
): Record<string, string> | undefined {
  if (!LOCALIZED_SEO_ENABLED) return undefined;
  const logical = localizedPath(path).path;
  const editions = PUBLIC_TRANSLATIONS[logical];
  return editions
    ? { en: logical, ...editions, "x-default": logical }
    : undefined;
}

export function isPublishedLocalizedPath(path: string): boolean {
  const parsed = localizedPath(path);
  return (
    parsed.locale !== "en" && publicEdition(parsed.path, parsed.locale) === path
  );
}
