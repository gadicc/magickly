import { readFileSync } from "node:fs";
import { PLANETARY_SPIRIT_IDS } from "magick-components/astrology/planetarySpirits";
import tabletNotes, { sourceUrl } from "magick-data/enochian/tabletNotes";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HEYDON_PAGES,
  HeydonCitation,
  heydonLabel,
  PLATE_X,
  PLATE_X_LABEL,
  PlateXCitation,
  RULER_SIGIL_PAGE,
  rulerSigilPage,
} from "./sigilSources";

/** A package source file's text, its JSDoc's line breaks and stars gone. */
const packageSource = (path: string) =>
  readFileSync(
    new URL(`../../packages/magick-components/src/${path}`, import.meta.url),
    "utf8",
  ).replace(/\s*\n\s*\*?\s*/g, " ");

const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("the sigils' sources", () => {
  it("links each leaf's page on archive.org, as checked in a browser", () => {
    // Opened on 13 November 2026: n124 shows p. 13 and n126 p. 15 of
    // Heydon's table, and n256 of the Equinox's file Plate X.
    expect(HEYDON_PAGES[13].url).toBe(
      "https://archive.org/details/theomagiaortempl00heyd/page/n124/mode/1up",
    );
    expect(HEYDON_PAGES[15].url).toBe(
      "https://archive.org/details/theomagiaortempl00heyd/page/n126/mode/1up",
    );
    expect(PLATE_X.url).toBe(
      "https://archive.org/details/crowley-equinox_202110/The%20Equinox%20Vol.%201%2C%20No.%207/page/n256/mode/1up",
    );
  });

  it("gives every Ruler's sigil a page, and nothing else one", () => {
    expect(Object.keys(RULER_SIGIL_PAGE).sort()).toEqual(
      [...PLANETARY_SPIRIT_IDS].sort(),
    );
    expect(rulerSigilPage("hismael")).toBe(15);
    expect(rulerSigilPage("sorath")).toBe(13);
    for (const id of ["shelachel", "toString", "constructor", ""])
      expect(rulerSigilPage(id), id).toBeUndefined();
  });

  it("cites the pages and leaves the package's JSDoc cites", () => {
    const spirits = packageSource("astrology/planetarySpirits.tsx");
    expect(spirits).toContain("`theomagiaortempl00heyd`");
    // The module's header: "p. 13 (leaf n124) and p. 15 (n126)".
    for (const [page, { leaf }] of Object.entries(HEYDON_PAGES))
      expect(spirits).toMatch(
        new RegExp(`p\\. ${page} \\((leaf )?n${leaf}\\)`),
      );
    // Each sigil's own comment names the page this module links for it.
    const raw = readFileSync(
      new URL(
        "../../packages/magick-components/src/astrology/planetarySpirits.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    for (const id of PLANETARY_SPIRIT_IDS) {
      const page = RULER_SIGIL_PAGE[id];
      const at = raw.indexOf(`\n  ${id}: {`);
      const comment = raw
        .slice(raw.lastIndexOf("/**", at), at)
        .replace(/\s*\n\s*\*?/g, " ");
      expect(at, id).toBeGreaterThan(0);
      expect(comment, id).toContain(`p. ${page} (n${HEYDON_PAGES[page].leaf})`);
    }
    const tablet = packageSource("enochian/Tablet.tsx");
    expect(tablet).toContain(
      '`crowley-equinox_202110`, the file "The Equinox Vol. 1, No. 7", leaf ' +
        `n${PLATE_X.leaf}`,
    );
  });

  it("links the Plate X the tablets' notes cite", () => {
    const equinox = tabletNotes.versions.find(
      (version) => version.id === "equinox",
    );
    const plate = equinox?.sources.find((source) => source.plate === "X");
    expect(plate?.leaf).toBe(PLATE_X.leaf);
    expect(PLATE_X.url).toBe(`${sourceUrl(plate!)}/mode/1up`);
  });

  it("names each source as its link reads", () => {
    for (const page of [13, 15] as const) {
      const html = renderToStaticMarkup(<HeydonCitation page={page} />);
      expect(html).toBe(`Heydon, <cite>Theomagia</cite> (1663/4), p. ${page}`);
      expect(text(html)).toBe(heydonLabel(page));
    }
    const plate = renderToStaticMarkup(<PlateXCitation />);
    expect(plate).toBe("<cite>The Equinox</cite> I(7) (1912), Plate X");
    expect(text(plate)).toBe(PLATE_X_LABEL);
  });
});
