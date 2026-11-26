import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

import LocaleProvider from "@/i18n/LocaleProvider";
import { messages as english } from "@/locales/en/messages.js";
import { messages as hebrew } from "@/locales/he/messages.js";
import { tabletFiles } from "@/seo/tablets";
import { dictionaryHref, linkedHeadword } from "./dictionaryLinks";
import { TABLET_NAME_LINKS } from "./nameLinks";
import { displayName } from "./nameWords";
import TabletPage from "./TabletPage";
import TabletsText from "./TabletsText";
import { gdNames, versionCounts } from "./tabletPageData";
import {
  TABLET_PAGE_IDS,
  type TabletPageId,
  tabletNeighbours,
  tabletToolHref,
} from "./tabletPages";
import { tabletQuery } from "./urlState";

const render = (node: React.ReactNode, locale: "en" | "he" = "en") =>
  renderToString(
    <LocaleProvider
      locale={locale}
      messages={locale === "en" ? english : hebrew}
    >
      {node}
    </LocaleProvider>,
  )
    .replaceAll("&amp;", "&")
    .replaceAll("&#x27;", "'")
    .replaceAll("<!-- -->", "");

const page = (tablet: TabletPageId, locale: "en" | "he" = "en") =>
  render(<TabletPage tablet={tablet} />, locale);

describe("a tablet's page", () => {
  it("shows the flat tablet's file with its alt text, and its SVG to download", () => {
    const html = page("fire");
    const { flat, pyramids } = tabletFiles("fire");
    expect(html).toContain(`src="${flat.png.path}"`);
    expect(html).toContain(
      'alt="The Enochian Fire tablet in the Golden Dawn\'s version: its sigil above a grid of thirteen rows of twelve letters"',
    );
    expect(html).toContain(`href="${flat.svg.path}"`);
    expect(html).toContain(`download="${flat.svg.name}"`);
    // The pyramids further down, loaded as they near the screen.
    expect(html).toMatch(
      new RegExp(`src="${pyramids.png.path}"[^>]*loading="lazy"`),
    );
    expect(html).toContain(`download="${pyramids.svg.name}"`);
    // The structured data names the same files.
    expect(html).toContain(`"contentUrl":"https://magick.ly${flat.png.path}"`);
    expect(html).toContain(
      `"contentUrl":"https://magick.ly${pyramids.svg.path}"`,
    );
  });

  it("opens with the holy names and King, or the Union's lines, then its note", () => {
    expect(page("earth")).toContain(
      "The Earth tablet is one of the four Watchtowers of Enochian magic. Its three holy names are Mor, Dial and Hctga, and its King is Iczhihal.",
    );
    expect(page("earth")).toContain("The Watchtower of the North, Earth,");
    expect(page("union")).toContain(
      "The Tablet of Union joins the four Watchtowers of Enochian magic. Its four lines are Exarp, Hcoma, Nanta and Bitom.",
    );
  });

  it("lists every name in the Golden Dawn's version, linking each with an entry", () => {
    for (const tablet of TABLET_PAGE_IDS) {
      const html = page(tablet);
      const names = gdNames(tablet);
      expect(names.length).toBe(tablet === "union" ? 5 : 58);
      for (const name of names) {
        const item = html.match(
          new RegExp(`<li data-name="${name.id}">(.*?)</li>`),
        )?.[1];
        expect(item, `${tablet} ${name.id}`).toContain(
          `>${displayName(name.spelling)}<`,
        );
        const headword = linkedHeadword(
          TABLET_NAME_LINKS,
          tablet,
          "gd",
          name.id,
        );
        if (headword)
          expect(item, `${tablet} ${name.id}`).toContain(
            `href="${dictionaryHref(headword)}"`,
          );
        else expect(item, `${tablet} ${name.id}`).not.toContain("href=");
      }
    }
    // Grouped as the tool groups them, with the Golden Dawn's labels.
    const earth = page("earth");
    expect(earth).toContain(">The Great Cross</h3>");
    expect(earth).toContain(">Air of Earth</h3>");
    expect(earth).toContain("The King, of the Sun");
    expect(page("union")).toContain(">The Tablet of Union</h3>");
  });

  it("counts the squares each other version changes, as the plan's table does", () => {
    const counts = (tablet: TabletPageId) =>
      Object.fromEntries(
        versionCounts(tablet).map(({ version, squares }) => [version, squares]),
      );
    expect(counts("earth")).toEqual({
      regardie: 1,
      equinox: 10,
      dee: 12,
      raphael: 6,
    });
    expect(counts("water")).toEqual({
      regardie: 6,
      equinox: 9,
      dee: 7,
      raphael: 6,
    });
    // Dee's and Raphael's have no Union.
    expect(counts("union")).toEqual({ regardie: 0, equinox: 0 });
    expect(page("earth")).toContain(
      '<li data-version="dee">Dee\'s, 1584: 12</li>',
    );
    // The Union's would be all zeros: left out, with its sentence.
    expect(page("union")).not.toContain("data-version");
    expect(page("union")).not.toContain("reads otherwise");
  });

  it("links into the tool as its own URLs write the choices", () => {
    for (const tablet of TABLET_PAGE_IDS) {
      const choice = { tablet, version: "gd" } as const;
      expect(tabletToolHref(tablet, "tablet")).toBe(
        `/enochian/tablets${tabletQuery(choice)}`,
      );
      expect(tabletToolHref(tablet, "differences")).toBe(
        `/enochian/tablets${tabletQuery({ ...choice, tab: "differences" })}`,
      );
      expect(tabletToolHref(tablet, "pyramids")).toBe(
        `/enochian/tablets${tabletQuery({ ...choice, pyramids: true, symbols: true })}`,
      );
    }
    expect(tabletToolHref("earth", "tablet")).toBe("/enochian/tablets");
    const html = page("fire");
    for (const view of ["tablet", "differences", "pyramids"] as const)
      expect(html).toContain(`href="${tabletToolHref("fire", view)}"`);
    expect(html).toContain('href="/enochian/tablets#tablets-pyramids"');
    // Regardie's p.295 for the colours, and pp.294 and 296, whose
    // drawings stand each symbol on its side's outer edge.
    for (const leaf of [287, 286, 288])
      expect(html).toContain(
        `href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n${leaf}`,
      );
  });

  it("closes with its sources and its neighbours", () => {
    const html = page("air");
    expect(html).toContain(
      'href="https://archive.org/details/IsraelRegardie-TheGoldenDawn-Vol4-1940/page/n262"',
    );
    expect(tabletNeighbours("earth")).toEqual({ prev: undefined, next: "air" });
    expect(tabletNeighbours("union")).toEqual({
      prev: "fire",
      next: undefined,
    });
    expect(html).toContain('href="/enochian/tablets/earth">← Earth Tablet');
    expect(html).toContain('href="/enochian/tablets/water">Water Tablet →');
  });

  it("translates its interface, not its data, in Hebrew", () => {
    const html = page("fire", "he");
    expect(html).toContain("לוח האש הוא אחד מארבעת מגדלי השמירה");
    expect(html).toContain('alt="לוח האש החנוכי בגרסת השחר הזהוב');
    expect(html).toContain("המלך, של השמש");
    expect(html).toContain("← לוח המים");
    // The note is English data.
    expect(html).toContain("The Watchtower of the South, Fire,");
  });

  it("stays within its size ceiling", () => {
    const source = readFileSync(
      path.join(import.meta.dirname, "TabletPage.tsx"),
      "utf8",
    );
    expect(source.split("\n").length).toBeLessThan(400);
  });
});

describe("the tablets' hub", () => {
  it("links each tablet's page", () => {
    const html = render(<TabletsText />);
    for (const tablet of TABLET_PAGE_IDS)
      expect(html).toContain(`href="/enochian/tablets/${tablet}"`);
  });
});
