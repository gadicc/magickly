import { plateRange } from "magick-data/kabbalah/lenain/firstTable";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MIRRORED_PAGES, pageUrl } from "@/sources/mirroredPages";
import { textOf } from "../../../../tests/entityPage";
import FirstTable from "./FirstTable";

/**
 * The reconstructed first table's account of the two plates, each linked to
 * its mirrored page, and the mirror's outline captions held to the rows the
 * data says each plate shows.
 */
describe("the first table's plates", () => {
  const html = renderToString(<FirstTable />);

  it("link each plate's page, which opens in the lightbox", () => {
    for (const key of ["lenainReissue25", "lenain25"] as const) {
      const page = MIRRORED_PAGES[key];
      expect(html, key).toContain(
        `href="${pageUrl(page).replace("&", "&amp;")}" aria-label="${page.label}" aria-haspopup="dialog"`,
      );
    }
    expect(textOf(html)).toContain(
      "The reissue's (p. 25) shows rows 62 to 72, printed above as they survive. The 1823 printing's (p. 25) was opened further",
    );
  });

  it("set Kircher's plate, Lenain's source, beside every row, linked", () => {
    const page = MIRRORED_PAGES.kircherPlate;
    expect(html).toContain(
      `href="${pageUrl(page)}" aria-label="${page.label}" aria-haspopup="dialog"`,
    );
    expect(html).toContain('<th scope="col">Kircher&#x27;s nation</th>');
    expect(html).toContain('<th scope="col">Kircher&#x27;s name of God</th>');
    const text = textOf(html);
    expect(text).toContain(
      "Beside each row is the same ray of Kircher's plate of the names of God by nation",
    );
    // Row 1: the Hebrews and the engraved name, its resh kept, in Hebrew.
    expect(html).toContain('<td lang="la">Hebræi</td>');
    expect(html).toContain('lang="he" dir="rtl"');
    expect(html).toContain("יהרה");
    // Rows 3 and 7: Lenain's cells empty, Kircher's shown, and a note.
    expect(html).toContain('<td lang="la">Chaldęi</td>');
    expect(html).toContain('<td lang="la">Armeni</td>');
    expect(
      text.match(/the entry names neither a nation nor a name of God/g),
    ).toHaveLength(2);
    // Each script with its language and direction.
    expect(html).toContain('lang="syr" dir="rtl"');
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain('lang="hy" dir="ltr"');
    expect(html).toContain('lang="grc" dir="ltr"');
  });

  it("marks the names whose letters are uncertain, in words", () => {
    const text = textOf(html);
    // Rays 1 to 5, 7, 15, 68 and 69: the reader's medium and low.
    expect(text.match(/\(reading uncertain\)/g)).toHaveLength(9);
    expect(text).toContain("יהרה (reading uncertain)");
    // Ray 1's slip and ray 7's guess are said beside their rows.
    expect(text).toContain(
      "Engraved יהרה, with a resh where the Tetragrammaton has vav: the engraver's slip, recorded and not corrected.",
    );
    expect(text).toContain(
      "The Armenian letters are a best guess at the engraved shapes",
    );
  });

  it("outline the rows the data says each plate shows", () => {
    for (const [key, plate] of [
      ["lenainReissue25", "plate1909"],
      ["lenain25", "plate1823"],
    ] as const) {
      const { from, to } = plateRange(plate);
      expect(MIRRORED_PAGES[key].cited, key).toContain(
        `rows ${from} to ${to} show`,
      );
    }
  });
});
