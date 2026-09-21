/**
 * Lenain's entries in full: read from the plates page by page, and translated
 * from that reading. Nothing here is repaired OCR — that is what plan 031
 * replaced, and what plan 033 finally deleted. The seventy-two run to about
 * 88 kB a language, and the list page only wants one when a reader opens it,
 * so they load here rather than with it. Each genius's own page renders them
 * on the server instead.
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
