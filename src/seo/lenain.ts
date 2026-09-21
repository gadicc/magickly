import { divisions } from "@/../data/kabbalah/lenain/volume";
import type { EntityPage } from "./entities";

/**
 * The Lenain edition's indexable pages.
 *
 * The chapters are the canonical unit and each carries its own title and
 * description, which is why the whole-book route is not indexed: it is a
 * byte-for-byte duplicate of all eleven, and if a search engine took it as
 * canonical the chapters would stop ranking and one 250 KB page would rank
 * weakly for everything. See plan 033.
 */

export const BOOK_PATH = "/books/la-science-cabalistique";

/** 160 characters is what a search snippet shows; the tests hold us to it. */
function snippet(text: string) {
  return text.length <= 160 ? text : `${text.slice(0, 157).trimEnd()}…`;
}

export function lenainChapterPage(slug: string): EntityPage | null {
  const division = divisions.find((entry) => entry.slug === slug);
  if (!division) return null;

  const where =
    division.slug === "preliminaires"
      ? "The half-title, the 1823 title page, Papus's preface to the reissue, and Lenain's own Avertissement"
      : `${division.heading} of Lazare Lenain's La Science Cabalistique (Amiens, 1823)`;
  const what = division.subtitle
    ? `: "${division.subtitle.replace(/\s*\.$/, "")}"`
    : "";

  return {
    path: `${BOOK_PATH}/${division.slug}`,
    title: division.title,
    description: snippet(`${where}${what}. Read from the original scan.`),
  };
}

/** Every chapter, in the book's order, for the sitemap. */
export function lenainPages(): EntityPage[] {
  return divisions
    .map((division) => lenainChapterPage(division.slug))
    .filter((page): page is EntityPage => page !== null);
}

/** Static params for the chapter route. */
export function lenainSlugs() {
  return divisions.map((division) => ({ division: division.slug }));
}
