/**
 * Lenain's entries in full: the scan repaired, and translated from that
 * repair. The seventy-two run to about 88 kB a language, and a reader only
 * wants one when they open it, so they load here rather than with the page —
 * as the Mercury widget's ephemeris does.
 *
 * Indexed by the angel's number less one.
 */

export type TextLanguage = "en" | "fr";

const loading = new Map<TextLanguage, Promise<string[]>>();

export function loadAngelTexts(language: TextLanguage): Promise<string[]> {
  const already = loading.get(language);
  if (already) return already;

  // No bundler can follow a computed path, so each language names its own
  // module; both are the JSON the build emits from the JSON5 sources.
  const texts = (
    language === "fr"
      ? import("../dist/kabbalah/seventyTwoAngelsText/fr.json")
      : import("../dist/kabbalah/seventyTwoAngelsText/en.json")
  ).then((module) => module.default as unknown as string[]);

  loading.set(language, texts);
  return texts;
}
