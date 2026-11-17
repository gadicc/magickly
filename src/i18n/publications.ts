import { localizedPath, type UiLocale } from "./locales";

/** Only complete public translations belong here. A UI catalog grants no public edition. */
export const PUBLIC_TRANSLATIONS = {
  "/": { he: "/he" },
  "/about": { he: "/he/about" },
} as const;

/** Return a real canonical edition, or null rather than an English clone. */
export function publicEdition(path: string, locale: UiLocale): string | null {
  const logical = localizedPath(path).path.replace(/\/+$/, "") || "/";
  if (locale === "en") return logical;
  return PUBLIC_TRANSLATIONS[logical]?.[locale] ?? null;
}

/** Static published alternates; ritual editions must come from their public resolver. */
export function publicAlternates(
  path: string,
): Record<string, string> | undefined {
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
