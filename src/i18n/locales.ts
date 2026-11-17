/** UI language is independent of a ritual's stored content language. */
export type UiLocale = "en" | "he";

export const UI_LOCALES: readonly UiLocale[] = ["en", "he"];
export const LOCALE_COOKIE = "magickly-ui-locale";

export const LOCALE_INFO = {
  en: { name: "English", direction: "ltr", flag: "🇺🇸" },
  he: { name: "עברית", direction: "rtl", flag: "🇮🇱" },
} as const;

export function isUiLocale(value: unknown): value is UiLocale {
  return value === "en" || value === "he";
}

/** Match supported languages, respecting q=0 and preference order. */
export function matchLanguage(header: string | null | undefined): UiLocale {
  const candidates = (header ?? "")
    .split(",")
    .map((entry, order) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = parameters.find((part) => part.trim().startsWith("q="));
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return { tag: tag.toLowerCase().split("-")[0], q, order };
    })
    .filter(({ q }) => Number.isFinite(q) && q > 0 && q <= 1)
    .sort((a, b) => b.q - a.q || a.order - b.order);
  return (
    (candidates.find(({ tag }) => isUiLocale(tag))?.tag as UiLocale) ?? "en"
  );
}

/** Cookie wins over browser negotiation; unsupported cookie values are ignored. */
export function preferredLocale(
  cookie: unknown,
  languages?: string | null,
): UiLocale {
  return isUiLocale(cookie) ? cookie : matchLanguage(languages);
}

/** Parse only our supported non-English prefix, never arbitrary two-letter sections. */
export function localizedPath(path: string): {
  locale: UiLocale;
  path: string;
} {
  return path === "/he" || path.startsWith("/he/")
    ? { locale: "he", path: path.slice(3) || "/" }
    : { locale: "en", path };
}

/** Unknown language-looking prefixes cannot bypass privacy matchers. `gd` is a real section. */
export function privacyPath(path: string): string {
  const parts = path.split("/");
  let start = 1;
  while (
    /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/i.test(parts[start] ?? "") &&
    parts[start] !== "gd"
  )
    start++;
  return start === 1 ? path : `/${parts.slice(start).join("/")}`;
}
