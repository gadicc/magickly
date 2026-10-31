import { createHash } from "node:crypto";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GeomancyReading from "./reading";
import { readingFromSearchParams } from "./readingState";

// The spirit sigils are SVG imports, which are components under SVGR and plain
// asset URLs under vitest. They carry no data this page is pinned for.
vi.mock("@/components/astrology/planetarySpirits", () => ({
  default: () => null,
}));

/** Size and hash together: one assertion, and the size localises a drift. */
const digest = (html: string) =>
  `${html.length} ${createHash("sha256").update(html).digest("hex")}`;

/**
 * Where each string starts, searching forward from the last one. A `-1` means
 * the string is missing or out of order.
 */
const positions = (html: string, texts: string[]) => {
  let at = 0;
  return texts.map((text) => {
    const found = html.indexOf(text, at);
    if (found >= 0) at = found + text.length;
    return found;
  });
};

/** The page's own starting reading, with only the house chosen. */
const render = (house: string) =>
  renderToString(
    <GeomancyReading
      initial={readingFromSearchParams(new URLSearchParams({ house }))}
    />,
  );

/**
 * The reading page joins the houses and `tetragram.meanings` positionally:
 * `houses.slice(1)` fills the select and `meanings[parseInt(houseNoStr)]`
 * reads each interpretation. Plan 032 rekeys both by house number, so the
 * bytes of the default reading at the first, a middle and the last house are
 * pinned first. Its figures are always Laetitia and Cauda Draconis as the two
 * witnesses and Conjunctio as the judge; each case below lists the chosen
 * house's own meaning, which the closed select still shows, and then what
 * those three figures say in that house, in the order the page prints them.
 */
describe("geomancy reading page", () => {
  it.each([
    [
      "1",
      "79028 a95d2ea9ebf8db61e8e7844e46ff064bc6f34264931daa2aab4fa249534dfc1a",
      [
        "Personality of the Querent",
        "Good, except in war.",
        "Destroy figure if it falls here! Makes judgment worthless.",
        "Good with good, evil with evil.",
      ],
    ],
    [
      "7",
      "78979 2872d55fb7a70ae2105e96b65dbbecd8e22bc0c0737315a21fc18bebb32a95ee",
      [
        "Love, marriage, prostitution",
        "Indifferent.",
        "Unfavourable, war, and fire.",
        "Rather good.",
      ],
    ],
    [
      "12",
      "78960 1c1a97ab4aa8b185c651ffc0ff439b447447247a79e9962e6f65d56f8b5fc5f7",
      [
        "Sorrow, hospitals, intrigue",
        "Unfavourable generally.",
        "Rather good.",
        "Medium. Bad for prisoners",
      ],
    ],
  ])(
    "renders the same bytes in house %s it did before the rekey",
    (house, expected, texts) => {
      const html = render(house);
      expect(digest(html)).toBe(expected);
      expect(positions(html, texts)).not.toContain(-1);
    },
  );
});
