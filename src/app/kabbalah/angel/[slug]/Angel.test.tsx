import { readFileSync } from "node:fs";
import path from "node:path";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { loadAngelTexts } from "magick-data/kabbalah/seventyTwoAngels/text";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { angelBySlug, angelSlug } from "@/lib/angelSlugs";
import { expectEntityPage, textOf } from "../../../../../tests/entityPage";
import AngelRoute from "../../../(public)/kabbalah/angel/[slug]/page";
import AngelPage from "./Angel";

/**
 * The angel page, moved onto the entity pages' shared pieces (plan 036).
 *
 * The move is pinned by a golden: the text of Ariel's page, the 46th, which
 * has editorial notes, a Hebrew name with Lenain's pointing, a psalm with its
 * Latin, and a neighbour on each side. It was captured on `ceae007`, before
 * the refactor, by rendering the body as it was then —
 * `renderToString(await AngelPage({ angel }))`, since the body was `async` —
 * and reducing the markup with `textOf`. It is not to be regenerated: the
 * refactor changed the page's frame, links and styles and none of its text,
 * and this is what says so. The body is synchronous now, with the texts
 * loaded by the route, and the route is held to the same text.
 *
 * It has been regenerated once since, the same way, for plan 033's other
 * witnesses: the notes now cite the 1823 printing and the manuscript copy
 * with links, the pointed Hebrew is "as the page points it" rather than
 * Lenain's, and "In the book" says its page numbers are the reissue's.
 * Nothing else in the text changed.
 *
 * And once more for plan 088's S4, which added the Rose Cross sigil's
 * section after the table (its heading, the sentence linking the
 * generator and the two downloads). Nothing else in the text changed.
 */
const GOLDEN = readFileSync(
  path.join(import.meta.dirname, "angel.golden.txt"),
  "utf8",
);

const params = (slug: string) => ({
  params: Promise.resolve({ slug }),
  searchParams: Promise.resolve({}),
});

async function body(no: number) {
  const [english, french] = await Promise.all([
    loadAngelTexts("en"),
    loadAngelTexts("fr"),
  ]);
  return renderToString(
    <AngelPage
      angel={angels[no - 1]}
      english={english[no - 1]}
      french={french[no - 1]}
    />,
  );
}

describe("the angel page", () => {
  it("renders Ariel's text as it did before the refactor", async () => {
    const ariel = angelBySlug("ariel");
    expect(ariel?.no).toBe(46);
    expect(textOf(await body(46))).toBe(GOLDEN);
  });

  it("hands the body the angel's own texts", async () => {
    expect(textOf(renderToString(await AngelRoute(params("ariel"))))).toBe(
      GOLDEN,
    );
  });

  it("holds all seventy-two to what every entity page must hold", async () => {
    for (const angel of angels) {
      const html = await body(angel.no);
      expectEntityPage(html, `${angel.no}. ${angel.name.en}`);
      // The nav links each neighbour; the first and the last have one.
      const around = [angel.no - 1, angel.no + 1].filter(
        (no) => no >= 1 && no <= angels.length,
      );
      for (const no of around)
        expect(html, angelSlug(angel.no)).toContain(
          `href="/kabbalah/angel/${angelSlug(no)}"`,
        );
    }
  });

  it("shows the sigil's static PNG and links its files and the generator", async () => {
    const html = await body(1);
    expect(html).toContain(
      '<img src="/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png" width="1024" height="1024" alt="The Rose Cross sigil of Vehuiah, והויה, traced on the Golden Dawn&#x27;s rose of 22 letters" loading="lazy"',
    );
    expect(html).toContain(
      `href="/gd/sigils?text=${encodeURIComponent("והויה")}"`,
    );
    expect(html).toMatch(
      /<a [^>]*download="vehuiah-rose-cross-sigil\.png" href="\/kabbalah\/angel\/vehuiah\/vehuiah-rose-cross-sigil\.png"[^>]*>Download PNG<\/a>/,
    );
    expect(html).toMatch(
      /<a [^>]*download="vehuiah-rose-cross-sigil\.svg" href="\/kabbalah\/angel\/vehuiah\/vehuiah-rose-cross-sigil\.svg"[^>]*>Download SVG<\/a>/,
    );
  });

  it("links the decade's planet and the sign to their pages", async () => {
    const html = await body(46);
    // Ariel, the 46th: 16–20° of Scorpio, the 23rd decade, under Sol.
    expect(html).toMatch(
      /<a [^>]*href="\/astrology\/zodiac#scorpio"[^>]*>Scorpio<\/a>/,
    );
    expect(html).toMatch(
      /<a [^>]*href="\/astrology\/planet\/sol"[^>]*>Sol<\/a>/,
    );
  });

  it("links the other copies an editorial note cites", async () => {
    const html = await body(46);
    expect(html).toContain(
      '<a href="https://books.google.com/books?id=qt9SAAAAcAAJ&amp;pg=PA76" rel="noopener">1823 printing, p. 76</a>',
    );
    expect(html).toContain(
      '<a href="https://archive.org/details/BIUSante_ms05365/page/n83/mode/1up" rel="noopener">Ms 5365, leaf n83</a>',
    );
  });

  it("does not call a misprinted name Lenain's pointing", async () => {
    // The reissue prints אנואל for the 37th; 1823 has אניאל, which is used.
    expect(textOf(await body(37))).toContain(
      "אניאל — as the reissue misprints it: ",
    );
    expect(textOf(await body(46))).toContain("עריאל — as the page points it: ");
  });

  it("says which hour is used where none is printed", async () => {
    // The eighth gives no hour in either printing; the tables' is used.
    expect(textOf(await body(8))).toContain(
      "invocation correction · 2:20 — Neither the 1823 printing (p. 50)",
    );
  });

  it("marks the Hebrew inside a note as Hebrew", async () => {
    const html = await body(37);
    expect(html).toMatch(
      /reads “<span lang="he" dir="rtl"[^>]*>אניאל<\/span>” \(p\. 69\)/,
    );
  });
});
