import { divisions, leavesOf } from "@/../data/kabbalah/lenain/volume";
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

/** The printed pages a division runs across, as the volume numbers them. */
function printedRange(slug: string) {
  const division = divisions.find((entry) => entry.slug === slug);
  if (!division) return {};
  const numbered = leavesOf(division).filter((leaf) => leaf.page.label);
  const first = numbered[0]?.page.label;
  const last = numbered[numbered.length - 1]?.page.label;
  if (!first || !last) return {};
  return {
    pageStart: first,
    pageEnd: last,
    pagination: first === last ? first : `${first}-${last}`,
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

/**
 * Structured data for the edition.
 *
 * The licence goes on the *edition*, never on the Book. Lenain's text is
 * public domain and nothing may be claimed over it; what is CC BY 4.0 is the
 * reading of it — the transcription, the translation, the apparatus. Putting
 * `license` on the `Book` would assert a right over a public-domain work,
 * which is the one thing this whole edition exists not to do.
 *
 * Expect no rich result from `Book`: Google's requires a feed. The visible win
 * is `BreadcrumbList`, which the site has nowhere else. See plan 033.
 */

const SCAN_URL = "https://books.google.com/books?id=ZqgpxTZ43HkC";
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

const LENAIN = {
  "@type": "Person",
  name: "Lazare Lenain",
  birthDate: "1793",
  deathDate: "1877",
};

/** The book itself, with its chapters as parts. */
export function bookJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: "La Science Cabalistique: a reading of the 1823 edition",
    url: `${siteUrl}${BOOK_PATH}`,
    license: CC_BY,
    creditText: "magick.ly",
    isBasedOn: {
      "@type": "Book",
      name: "La Science Cabalistique, ou l'art de connaître les bons génies qui influent sur la destinée des hommes",
      author: LENAIN,
      datePublished: "1823",
      inLanguage: "fr",
      locationCreated: { "@type": "Place", name: "Amiens" },
      sameAs: SCAN_URL,
      hasPart: divisions.map((division) => ({
        "@type": "Chapter",
        name: division.heading,
        alternateName: division.title,
        url: `${siteUrl}${BOOK_PATH}/${division.slug}`,
        // Lenain's own pages, not the scan's: a bibliographic pagination that
        // cites the PDF is no use to anyone holding the book.
        ...printedRange(division.slug),
      })),
    },
  };
}

/** One chapter, and the trail that leads to it. */
export function chapterJsonLd(siteUrl: string, slug: string) {
  const division = divisions.find((entry) => entry.slug === slug);
  if (!division) return null;
  const url = `${siteUrl}${BOOK_PATH}/${division.slug}`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Chapter",
      name: division.heading,
      alternateName: division.title,
      url,
      inLanguage: "fr",
      isPartOf: {
        "@type": "Book",
        name: "La Science Cabalistique",
        author: LENAIN,
        datePublished: "1823",
        url: `${siteUrl}${BOOK_PATH}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Books", item: `${siteUrl}/books` },
        { name: "La Science Cabalistique", item: `${siteUrl}${BOOK_PATH}` },
        { name: division.title, item: url },
      ].map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        ...crumb,
      })),
    },
  ];
}
