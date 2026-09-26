import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Data from "@/../data/data";
import { expectEntityPage, textOf } from "../../../../../tests/entityPage";
import PathPage from "./page";

/**
 * The path page, laid out from its row (plan 036).
 *
 * It printed the row as JSON below a table whose letter read the `mathers`
 * field no letter has, so every path said `Aleph ("")`. Every path is held to
 * what every entity page must hold, and the paths below each pin one of the
 * ways a path differs: which trees draw it, whether its letter has a planet,
 * and where it falls in the chain.
 */
const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

const render = async (id: string) => renderToString(await PathPage(props(id)));

const inner = (html: string, tag: string) =>
  html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";

/** The page's sections, by the text of their headings, as markup. */
function sections(html: string) {
  return Object.fromEntries(
    [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map(
      ([, section]) => [textOf(inner(section, "h2")), section],
    ),
  );
}

/** A table's rows, as a reader sees them: each label with its value's text. */
function rowsOf(html: string) {
  return Object.fromEntries(
    [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => [
      textOf(inner(row, "th")),
      textOf(inner(row, "td")),
    ]),
  );
}

/** The text of every link to `href`. */
function linksTo(html: string, href: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(([, attributes]) => attributes.includes(` href="${href}"`))
    .map(([, , text]) => textOf(text));
}

describe("the path page", () => {
  it("holds every path to what every entity page must hold", async () => {
    for (const path of Object.values(Data.tolPath)) {
      const html = await render(path.id);
      const pair = `${path.from.name.roman} – ${path.to.name.roman}`;
      expectEntityPage(
        html,
        path.hermetic
          ? `Path ${path.hermetic.pathNo}: ${pair}`
          : `Path ${pair}`,
      );
      // What the letter's missing `mathers` field printed on every path.
      expect(html, path.id).not.toContain("&quot;&quot;");
    }
  });

  it("gives the first path its letter and trump, and no planet", async () => {
    // Path 11 opens the chain, and Aleph is a mother letter, with no planet.
    const html = await render("1_2");
    const text = textOf(html);
    expect(textOf(inner(html, "h1"))).toBe("Path 11: Keter – Chochmah");
    expect(text).toContain("Joins Keter and Chochmah");
    const { "Hermetic tree": hermetic, "Hebrew tree": hebrew } = sections(html);
    expect(Object.keys(rowsOf(hermetic))).toEqual(["Letter", "Tarot"]);
    expect(rowsOf(hermetic).Letter).toBe("אAleph · 1 · “ox”");
    expect(rowsOf(hermetic).Tarot).toBe("The Fool (0)");
    expect(rowsOf(hebrew)).toEqual({ Letter: "הHe · 5 · “window”" });
    // No previous path: neither the arrow nor the nav's link.
    expect(html).not.toContain('aria-label="Previous');
    expect(text).not.toContain("←");
    expect(linksTo(html, "/kabbalah/path/1_3")).toEqual([
      "❯",
      "Path 12: Keter – Binah →",
    ]);
  });

  it("names a double letter's planet on the Hermetic tree only", async () => {
    // Gimel is Luna's letter on the Hermetic tree; on the Hebrew tree the
    // path carries Dalet, which is Venus's letter there and has no planet on
    // this page, since the data's attributions are the Hermetic tree's.
    const html = await render("1_6");
    expect(textOf(inner(html, "h1"))).toBe("Path 13: Keter – Tiferet");
    expect(linksTo(html, "/kabbalah/sephirah/keter")).toContain("Keter");
    expect(linksTo(html, "/kabbalah/sephirah/tiferet")).toContain("Tiferet");
    const { "Hermetic tree": hermetic, "Hebrew tree": hebrew } = sections(html);
    expect(rowsOf(hermetic)).toEqual({
      Letter: "גGimel · 3 · “camel”",
      // The Rider–Waite card's name, not the deck's "The Papess/High
      // Priestess", since the image is the Rider–Waite card.
      Tarot: "The High Priestess (II)",
      Planet: "☾ Luna",
    });
    expect(linksTo(hermetic, "/astrology/planet/luna")).toEqual(["☾ Luna"]);
    expect(hermetic).toContain("RWS_Tarot_02_High_Priestess.jpg");
    expect(rowsOf(hebrew)).toEqual({ Letter: "דDalet · 4 · “door”" });
    expect(linksTo(html, "/kabbalah/path/1_3")).toEqual([
      "❮",
      "← Path 12: Keter – Binah",
    ]);
    expect(linksTo(html, "/kabbalah/path/2_3")).toEqual([
      "❯",
      "Path 14: Chochmah – Binah →",
    ]);
  });

  it("draws a Hebrew-only path on the Hebrew tree, unnumbered", async () => {
    // Chochmah–Gevurah is one of the two paths the Hermetic tree omits.
    const html = await render("2_5");
    expect(textOf(inner(html, "h1"))).toBe("Path Chochmah – Gevurah");
    expect(textOf(html)).toContain(
      "Joins Chochmah and Gevurah; the Hermetic tree does not draw it",
    );
    const { "Hebrew tree": hebrew, ...others } = sections(html);
    expect(others).toEqual({});
    expect(rowsOf(hebrew)).toEqual({
      Letter: "זZayin · 7 · “sword, armor, weapon”",
    });
    // The Tree is the Hebrew one: it has this path and Binah–Chesed, the
    // other the Hermetic tree omits, and not Netzach–Malchut, which only
    // the Hermetic tree draws.
    expect(html).toContain('id="path2_5"');
    expect(html).toContain('id="path3_4"');
    expect(html).not.toContain('id="path7_10"');
  });

  it("says a Hermetic-only path is not on the Hebrew tree", async () => {
    // Netzach–Malchut is one of the two paths the Hebrew tree omits.
    const html = await render("7_10");
    const { "Hermetic tree": hermetic, ...others } = sections(html);
    expect(others).toEqual({});
    expect(textOf(hermetic)).toContain(
      "The Hebrew tree does not draw this path.",
    );
    expect(html).toContain('id="path7_10"');
    expect(html).not.toContain('id="path2_5"');
  });

  it("carries the last Hermetic path on to the Hebrew-only ones", async () => {
    // Path 32 ends the Hermetic numbering, and the chain goes on to 2_5.
    const html = await render("9_10");
    expect(textOf(inner(html, "h1"))).toBe("Path 32: Yesod – Malchut");
    expect(rowsOf(sections(html)["Hermetic tree"]).Tarot).toBe(
      "The World (XXI)",
    );
    expect(linksTo(html, "/kabbalah/path/2_5")).toEqual([
      "❯",
      "Path Chochmah – Gevurah →",
    ]);
    expect(html).toContain('aria-label="Next: Path Chochmah – Gevurah"');
  });
});
