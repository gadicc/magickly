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
    expect(digest(html)).toBe(
      "62119 863e323249bc2ba11753bf0ba7b675bc0aaebff526d5d343b451657d4374d161",
    );
  });

  it("lists the twelve houses in order", () => {
    expect(
      positions(html, [
        "Personality of the Querent",
        "Money, property, finances",
        "Communication, relatives by blood",
        "Home, inheritance, possessions",
        "Women, luxury, drinking",
        "Employees, sickness",
        "Love, marriage, prostitution",
        "Death, Wills, legacies",
        "Long journeys, relationships",
        "Fame, reputation, honor",
        "Friends, social contacts",
        "Sorrow, hospitals, intrigue",
      ]),
    ).not.toContain(-1);
  });

  it("lists a tetragram's twelve meanings in house order", () => {
    expect(
      positions(html, [
        "Happy, success in all things.",
        "Very prosperous.",
        "Favor and riches.",
        "Good fortune and success.",
        "Good success.",
        "Good - especially if it agrees with the 5th.",
        "Reasonably good.",
        "Rather good, but not very. The sick shall die.",
        "Good in all demands.",
        "Good in suits.",
        "Good in all.",
        "Unfavourable, pain and loss.",
      ]),
    ).not.toContain(-1);
  });
});
