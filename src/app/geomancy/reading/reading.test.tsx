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
  // Re-pinned when "Mothers" and "Interpretation" became h2s, and when plan
  // 075 replaced the texts with the Equinox's table, the houses and the
  // invocation in our own words (10 November 2026); the bytes are otherwise
  // those from before the rekey.
  it.each([
    [
      "1",
      "79423 ab11cc883462e2534f24f6de656cce95246aab0d86f01adb0c74eebdb2bafbc0",
      [
        "The querent: their life",
        "Good, except in war.",
        "Destroy the figure.",
        "Good with good, bad with bad.",
      ],
    ],
    [
      "7",
      "79413 49439a308d164e35a995dab6c762f0bc4a61d3c6db703320e331db44fc1127dd",
      [
        "Marriage and other unions",
        "Indifferent.",
        "Unfavourable, war, and fire.",
        "Rather good.",
      ],
    ],
    [
      "12",
      "79424 341bf7f3a303be6297b0037fc78edbfb8bdcb216d3cc8f74e89557d27109e2d1",
      [
        "Enemies; servants; imprisonment",
        "Unfavourable generally.",
        "Rather good.",
        "Medium, bad for prisoners.",
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
