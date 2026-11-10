import { createHash } from "node:crypto";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GeomancyReference from "./reference";

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

/**
 * The reference page prints the twelve geomanic houses and every tetragram's
 * twelve meanings straight out of the data, both of which are padded arrays
 * read with `.slice(1)` and index arithmetic. Plan 032 rekeys them by house
 * number, so these bytes are pinned first: the rekey must not move them.
 */
describe("geomancy reference page", () => {
  const html = renderToString(<GeomancyReference />);

  it("renders the same bytes it did before the data was rekeyed", () => {
    // Re-pinned when the headings became h2s and "Geomanic" and "ofThe" were
    // corrected, and when plan 075 replaced the texts with the Equinox's
    // table and the houses in our own words (10 November 2026).
    expect(digest(html)).toBe(
      "62257 5618f8259dc1e10d30aac40e0b0b355b2a8053ad2010faa6a25d1fa642ac807e",
    );
  });

  it("lists the twelve houses in order", () => {
    expect(
      positions(html, [
        "The querent: their life",
        "Money and possessions:",
        "Brothers, sisters and other kin",
        "Father and forebears;",
        "Envoys and messengers;",
        "Illness and its cures;",
        "Marriage and other unions",
        "Death, and what comes",
        "Long journeys; faith",
        "Honour, rank and reputation;",
        "Friends; the wealth",
        "Enemies; servants;",
      ]),
    ).not.toContain(-1);
  });

  it("lists a tetragram's twelve meanings in house order", () => {
    expect(
      positions(html, [
        "Happy success in all things.",
        "Very prosperous.",
        "Favour and riches.",
        "Good fortune and success.",
        "Good success.",
        "Good, especially agreeing with 5th.",
        "Reasonably good.",
        "Rather good, not very, the sick die.",
        "Good in all.",
        "Good in suits, very prosperous.",
        "Good in all.",
        "Unfavourable, pain, and loss.",
      ]),
    ).not.toContain(-1);
  });
});
