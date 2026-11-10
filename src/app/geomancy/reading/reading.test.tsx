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
 *
 * Plan 072 changed the bytes once on purpose: while the place is loading the
 * hours select reads "Planetary Hour for Luna", without the dangling " in "
 * the GeoIP hook left, and the place chooser's slot before it renumbers two
 * `useId`s. Nothing else differed.
 */
describe("geomancy reading page", () => {
  // Re-pinned when "Mothers" and "Interpretation" became h2s and when the
  // credit named the Hensons' essay (10 November 2026); the bytes are
  // otherwise those from before the rekey.
  it.each([
    [
      "1",
      "79107 bad99e428c7a81a2a9d92dae1e46f78865211a9e8c386b6d4f46d1f8e25642da",
      [
        "Personality of the Querent",
        "Good, except in war.",
        "Destroy figure if it falls here! Makes judgment worthless.",
        "Good with good, evil with evil.",
      ],
    ],
    [
      "7",
      "79058 525978338a88beab13fba90c471cd4fad61a4815616b9dafc126131715ec1f3b",
      [
        "Love, marriage, prostitution",
        "Indifferent.",
        "Unfavourable, war, and fire.",
        "Rather good.",
      ],
    ],
    [
      "12",
      "79039 e136ee0a22edbbfc62626aac58cc29e6da4261c9fa99b86b3386124a895284fb",
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
