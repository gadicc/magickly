import { createHash } from "node:crypto";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GeomancyReading from "./reading";
import { readingFromSearchParams } from "./readingState";

// The spirit sigils were SVG imports, which vitest could not render, when
// these bytes were pinned; they carry no data this page is pinned for.
vi.mock("magick-components/astrology/PlanetarySpirit", () => ({
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
  // ab11cc88…, 79413 49439a30… and 79424 341bf7f3…), and when the Mothers'
  // grid lines became the `ink` variable with black as its fallback (before
  // that, 80300 83f38421…, 80290 045035b8… and 80301 584de33d…), and when
  // the hints switch's label named the Key of Solomon in place of the
  // removed `magickTypes` (before that, 80804 a3969ba3…, 80794 95663f49…
  // and 80805 c2462b01…), and when the export buttons became tap-sized
  // targets, which changed only their styles and class names (before that,
  // 80837 910f4c74…, 80827 bd978df9… and 80838 88f4df44…), and when the
  // export buttons' box gained `data-export-controls`, the drawing pages'
  // hook to align them, and nothing else (before that, 81343 c55494a3…,
  // 81333 6aeda904… and 81344 adb50519…), and when plan 097 redrew the
  // export controls as one row per format: the page without them is
  // byte-for-byte the same, and before and after they are one unbroken
  // insertion at the same place (before that, 81367 90d5e50d…, 81357
  // f3d03d65… and 81368 42c28fb8…), and when its stage 2 moved the page
  // link to Share, removing only the block's "Copy page link" line (before
  // that, 92078 ec8a8774…, 92068 a855467e… and 92079 a2bae48b…); the
  // bytes are otherwise those from before the rekey.
  it.each([
    [
      "1",
      "87590 399b85e313d99d782171f937802959dea8e95f77024e945001e7887d759b9aa7",
      [
        "The querent: their life",
        "Good, except in war.",
        "Destroy the figure.",
        "Good with good, bad with bad.",
      ],
    ],
    [
      "7",
      "87580 e5823b70ebeb6f7a50e27ff20740da5196e036ed9fa03bd3ace526d5d71ae23d",
      [
        "Marriage and other unions",
        "Indifferent.",
        "Unfavourable, war, and fire.",
        "Rather good.",
      ],
    ],
    [
      "12",
      "87591 298859199dd982ac99354d04ed26ba2403bb2efe9fb0828322f6e5da24882cc2",
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
