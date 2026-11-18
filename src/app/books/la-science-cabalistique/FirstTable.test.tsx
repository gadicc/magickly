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
