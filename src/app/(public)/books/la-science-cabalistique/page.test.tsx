import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MIRRORED_PAGES, pageUrl } from "@/sources/mirroredPages";
import { textOf } from "../../../../../tests/entityPage";
import BookPage from "./page";

/**
 * The book's front page, where "About this edition" lists the copies the
 * edition is read from and cites. JSX drops a space at a line break before an
 * element, so the list is checked as a reader sees it.
 */
describe("the book's sources", () => {
  const html = renderToString(<BookPage />);
  const text = textOf(html);

  it("names and describes each copy read", () => {
    expect(text).toContain(
      "The base text: the reissue, Google Books ZqgpxTZ43HkC, the Bibliothèque municipale de Lyon's copy, whose folded plate shows the first table's rows 62 to 72 (p. 25).",
    );
    expect(text).toContain(
      "The 1823 printing, Koninklijke Bibliotheek copy: Google Books qt9SAAAAcAAJ. Cited in the editorial notes",
    );
    expect(text).toContain(
      "shows rows 57 to 72, and the same page names Lenain's sources (p. 25).",
    );
    expect(text).toContain(
      "A second copy of the reissue, also Lyon's: Google Books BqzyzEEX3MAC, its plate folded the same way",
    );
    expect(text).toContain("Ms 5365, an undated handwritten copy");
    expect(text).toContain(
      "Bibliothèque Louis Aragon, shelfmarks 42247 and M 2762: not digitised",
    );
    // Each shelfmark links its own record (checked 18 November 2026).
    const slug =
      "la-science-cabalistique-ou-l-art-de-connaitre-les-bons-genies-qui-influent-sur-la-destinee-des-homme";
    expect(html).toContain(
      `<a href="https://bibliotheques.amiens.fr/Default/doc/SYRACUSE/1711996/${slug}">42247</a>`,
    );
    expect(html).toContain(
      `<a href="https://bibliotheques.amiens.fr/Default/doc/SYRACUSE/293461/${slug}">M 2762</a>`,
    );
  });

  it("cites Lenain's own sources with their pages, spaced", () => {
    expect(text).toContain(
      "The Hague 1727, vol. II, pp. 109 and 110: the seventy-two names, in the spellings Lenain uses, without nations or names of God.",
    );
    expect(text).toContain(
      "vol. II part 1, 1653, pp. 271, 272 and 273: the seventy-two by choir,",
    );
    expect(text).toContain(
      "; and p. 287, where Kircher says every nation's name of God has four letters and introduces the plate of them that follows.",
    );
    // The plate is in other copies: the Polish one, transcribed and
    // mirrored, and the Complutense's, partly folded, an outside link.
    expect(text).toContain(
      "Kircher's plate after p. 287, which the copy above lacks: seventy-two four-letter names of God, each with its nation. The first table's last two columns follow it row for row, and it is transcribed here from the National Library of Poland's copy, on Wikimedia Commons;",
    );
    expect(text).toContain(
      "A second copy, the Universidad Complutense de Madrid's, was photographed partly folded: archive.org bub_gb_XjfzMnomDQoC, leaf n294.",
    );
    expect(html).toContain(
      '<a href="https://archive.org/details/bub_gb_XjfzMnomDQoC/page/n294/mode/1up">',
    );
    // The mirror's link is the plate's only link: its href is the file page.
    expect(
      html.split(`href="${pageUrl(MIRRORED_PAGES.kircherPlate)}"`).length - 1,
    ).toBe(1);
    expect(text).not.toContain("neither the nations");
  });

  it("opens every mirrored page it cites in the lightbox", () => {
    for (const key of [
      "lenainReissue25",
      "lenain25",
      "agrippaFr109",
      "agrippaFr110",
      "kircher271",
      "kircher272",
      "kircher273",
      "kircher287",
      "kircherPlate",
    ] as const) {
      const page = MIRRORED_PAGES[key];
      const href = pageUrl(page).replace("&", "&amp;");
      expect(html, key).toContain(
        `<a href="${href}" aria-label="${page.label}" aria-haspopup="dialog">`,
      );
    }
  });
});
