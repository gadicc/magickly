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
  // invocation in our own words (10 November 2026), and when plan 076
  // wrapped the tetragrams and the chart in dark-mode ink spans and gave the
  // pentagram's box its ink classes (without them the bytes were 79423
  // ab11cc88…, 79413 49439a30… and 79424 341bf7f3…); the bytes are
  // otherwise those from before the rekey.
  it.each([
    [
      "1",
      "80300 83f38421d0d5a240f972445a74f9572920521facae4cf242c79cd814063e8921",
      [
        "The querent: their life",
        "Good, except in war.",
        "Destroy the figure.",
        "Good with good, bad with bad.",
      ],
    ],
    [
      "7",
      "80290 045035b880075d7310d0ae5aff9c5cccd8fd1736cc8fb860d094cb9c67e52160",
      [
        "Marriage and other unions",
        "Indifferent.",
        "Unfavourable, war, and fire.",
        "Rather good.",
      ],
    ],
    [
      "12",
      "80301 584de33d2da6b9048f04c2d9978c03a1a479518e30b15b36f401b789a3523e12",
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
