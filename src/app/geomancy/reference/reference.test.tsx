import { createHash } from "node:crypto";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GeomancyReference from "./reference";

// The spirit sigils were SVG imports, which vitest could not render, when
// these bytes were pinned; they carry no data this page is pinned for.
vi.mock("magick-components/astrology/planetarySpirits", () => ({
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
    // table and the houses in our own words (10 November 2026), and when
    // plan 076 wrapped the tetragrams and spirits in dark-mode ink spans
    // (with the spans removed the bytes are those above, 62257 5618f825…),
    // and when the Moon's intelligence gave Agrippa's name beside Shelachel
    // with a note on each (13 November 2026; with the two references and
    // the notes removed the bytes are those before, 63432 ad73c10d…), and
    // when the notes called 777's and the Golden Dawn's names variants and
    // said less about Shelachel (13 November 2026; with the notes' old
    // words the bytes are those before, 66525 40af8b13…).
    expect(digest(html)).toBe(
      "66554 c0f8d8485230125def12727c16f00d72fb6ca0978c0f99b94d0b29adf34a379d",
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

  it("gives the Moon both intelligences, each linked to its note", () => {
    const cell = html.match(
      /<span lang="he-Latn">Malcha betharsisim hed beruah schehakim<\/span>[\s\S]*?<\/td>/,
    )?.[0];
    expect(cell).toBeDefined();
    expect(cell).toContain(
      'href="#intelligence-note-1" id="intelligence-ref-1"',
    );
    expect(cell).toMatch(/ \/ <!-- -->Shelachel<sup/);
    expect(cell).toContain(
      'href="#intelligence-note-2" id="intelligence-ref-2"',
    );
    // The notes follow the table, under a heading of their own.
    expect(
      positions(html, [
        "Spirits and Rulers",
        '<h3 id="intelligence-notes-heading">Notes</h3>',
        '<li id="intelligence-note-1">',
        'href="#intelligence-ref-1"',
        '<li id="intelligence-note-2">',
        'href="#intelligence-ref-2"',
      ]),
    ).not.toContain(-1);
    // The other six keep their one name.
    for (const name of [
      "Nakhiel",
      "Tiriel",
      "Hagiel",
      "Graphiel",
      "Iophiel",
      "Agiel",
    ])
      expect(html).toMatch(new RegExp(`<td[^>]*>${name}</td>`));
  });
});
