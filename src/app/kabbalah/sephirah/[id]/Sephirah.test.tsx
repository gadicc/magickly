import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Data from "@/../data/data";
import {
  expectEntityPage,
  hrefsOf,
  textOf,
} from "../../../../../tests/entityPage";
import SephirahPage from "./page";

/**
 * The sephirah page, laid out from its row rather than dumped (plan 036).
 *
 * Every sephirah is rendered through the route and held to what every entity
 * page must hold, and then the cases the row makes differ: Keter at the top
 * of the chain with a heaven and a sphere for a planet, Tiferet with the most
 * paths and every world, Da'at outside the chain with almost nothing, Malchut
 * at the bottom with an empty scent, and the two spheres on each tree's odd
 * path out. What is asserted is what a reader sees, by its text.
 */

const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

const render = async (id: string) =>
  renderToString(await SephirahPage(props(id)));

/** The table's rows as a reader reads them: label, then value. */
function rowsOf(html: string): Array<[string, string]> {
  return [
    ...html.matchAll(
      /<tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g,
    ),
  ].map(([, label, value]) => [textOf(label).trim(), textOf(value).trim()]);
}

const labelsOf = (html: string) => rowsOf(html).map(([label]) => label);

const valueOf = (html: string, label: string) =>
  rowsOf(html).find(([row]) => row === label)?.[1];

/** The markup of the row a label heads, for its links. */
function rowMarkup(html: string, label: string) {
  return [
    ...html.matchAll(/<tr><th scope="row">[\s\S]*?<\/th><td>[\s\S]*?<\/tr>/g),
  ]
    .map(([row]) => row)
    .find((row) => textOf(row.match(/<th[\s\S]*?<\/th>/)?.[0] ?? "") === label);
}

/** The Paths list's items, each as its text and its links. */
function pathsOf(html: string) {
  const list = html.match(/<h2>Paths<\/h2>[\s\S]*?<\/ul>/)?.[0] ?? "";
  return [...list.matchAll(/<li>[\s\S]*?<\/li>/g)].map(([item]) => ({
    text: textOf(item).trim(),
    hrefs: hrefsOf(item),
  }));
}

/** The closing nav's links. */
const navOf = (html: string) =>
  hrefsOf(html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0] ?? "");

describe("the sephirah page", () => {
  it("holds every sephirah to what every entity page must hold", async () => {
    for (const sephirah of Object.values(Data.sephirah)) {
      const html = await render(sephirah.id);
      expectEntityPage(html, `${sephirah.name.roman} · ${sephirah.name.he}`);
      // The arrows and the nav name each neighbour the chain gives it.
      for (const [side, other] of [
        ["Previous", sephirah.prev],
        ["Next", sephirah.next],
      ] as const)
        if (other) {
          expect(html, sephirah.id).toContain(
            `aria-label="${side}: ${other.name.roman}"`,
          );
          expect(navOf(html), sephirah.id).toContain(
            `/kabbalah/sephirah/${other.id}`,
          );
        }
    }
  });

  it("gives Keter its heaven, its sphere and no previous", async () => {
    // The top of the chain, and one of the three whose planet is a sphere.
    const html = await render("keter");
    expect(valueOf(html, "Heaven")).toBe(
      "ראשית הגלגולים Roshit haGilgulim “1st Swirlings / Primum Mobile”",
    );
    expect(labelsOf(html)).toContain("Sphere · Assiah");
    expect(labelsOf(html)).not.toContain("Planet · Assiah");
    expect(hrefsOf(rowMarkup(html, "Sphere · Assiah") ?? "")).toEqual([
      "/astrology/planet/primum-mobile",
    ]);
    expect(textOf(html)).toContain(
      "Crown, the first Sephirah of the Tree of Life",
    );
    expect(html).not.toContain('aria-label="Previous:');
    expect(navOf(html)).toEqual(["/kabbalah/sephirah/chochmah"]);
  });

  it("lists Tiferet's eight paths in Hermetic order, with every world", async () => {
    // The sphere with the most paths, all eight on both trees, and a
    // planet, a soul, a chakra and a grade: the plan's own example.
    const html = await render("tiferet");
    expect(textOf(html)).toContain(
      "Beauty, the sixth Sephirah of the Tree of Life",
    );
    // The trumps are named as their Rider–Waite cards print them, as the
    // path pages name them.
    expect(pathsOf(html)).toEqual(
      [
        ["13 ג Gimel to Keter, The High Priestess", "1_6", "keter"],
        ["15 ה He to Chochmah, The Emperor", "2_6", "chochmah"],
        ["17 ז Zayin to Binah, The Lovers", "3_6", "binah"],
        ["20 י Yod to Chesed, The Hermit", "4_6", "hesed"],
        ["22 ל Lamed to Gevurah, Justice", "5_6", "gevurah"],
        ["24 נ Nun to Netzach, Death", "6_7", "netzach"],
        ["25 ס Samekh to Yesod, Temperance", "6_9", "yesod"],
        ["26 ע Ayin to Hod, The Devil", "6_8", "hod"],
      ].map(([text, path, sephirah]) => ({
        text,
        hrefs: [`/kabbalah/path/${path}`, `/kabbalah/sephirah/${sephirah}`],
      })),
    );

    expect(labelsOf(html)).toEqual([
      "Name",
      "God name · Atziluth",
      "Archangel · Briah",
      "Angelic order · Yetzirah",
      "Planet · Assiah",
      "Colours",
      "Soul",
      "Chakra",
      "Body",
      "Stone",
      "Scent",
      "Grade",
    ]);
    expect(valueOf(html, "Planet · Assiah")).toBe("☉ Sol");
    expect(valueOf(html, "Chakra")).toBe("Heart अनाहत Anahata “Unstruck”");
    expect(valueOf(html, "Grade")).toBe("5=6 Adeptus Minor");
    expect(hrefsOf(rowMarkup(html, "Grade") ?? "")).toEqual(["/gd/grade/5=6"]);
  });

  it("calls Da'at the hidden Sephirah and draws it", async () => {
    // Outside the chain, with a god name, a Queen scale and a body and
    // nothing else; the one page whose Tree must be drawn with Da'at on it.
    const html = await render("daat");
    expect(textOf(html)).toContain(
      "Knowledge, the hidden Sephirah of the Tree of Life",
    );
    expect(labelsOf(html)).toEqual([
      "Name",
      "God name · Atziluth",
      "Colours",
      "Body",
    ]);
    expect(valueOf(html, "Colours")).toBe("Queen scale lavender");
    expect(html).toContain('xlink:href="/kabbalah/sephirah/daat"');
    expect(await render("tiferet")).not.toContain(
      'xlink:href="/kabbalah/sephirah/daat"',
    );
    // No paths, no neighbours: no section, no arrows, no nav.
    expect(html).not.toContain("<h2>Paths</h2>");
    expect(html).not.toContain('aria-label="Previous:');
    expect(html).not.toContain('aria-label="Next:');
    expect(html).not.toContain("<nav");
  });

  it("gives Malchut its heaven and no scent", async () => {
    // The bottom of the chain, whose scent is an empty string in the data,
    // and whose Queen scale is the quartered disc.
    const html = await render("malchut");
    expect(valueOf(html, "Heaven")).toBe(
      "עולם יסודות Olam Yesodoth “Sphere of the Elements”",
    );
    expect(labelsOf(html)).not.toContain("Scent");
    expect(labelsOf(html)).toContain("Stone");
    expect(rowMarkup(html, "Colours")).toContain(
      "background:conic-gradient(#80461B,#ba0,#880,#000000)",
    );
    expect(valueOf(html, "Colours")).toBe(
      "King scale yellow Queen scale russet, citrine, olive, black",
    );
  });

  it("marks Chochmah's path to Gevurah as the Hebrew tree's", async () => {
    // 2_5 has no Hermetic number, so it comes last, after the numbered four.
    const paths = pathsOf(await render("chochmah"));
    expect(paths.map(({ text }) => text.split(" ")[0])).toEqual([
      "11",
      "14",
      "15",
      "16",
      "ז",
    ]);
    expect(paths.at(-1)).toEqual({
      text: "ז Zayin to Gevurah · Hebrew tree only",
      hrefs: ["/kabbalah/path/2_5", "/kabbalah/sephirah/gevurah"],
    });
    expect(paths.filter(({ text }) => text.includes("tree only"))).toHaveLength(
      1,
    );
  });

  it("marks Netzach's path to Malchut as the Hermetic tree's", async () => {
    // 7_10 is numbered, 29, and has no letter on the Hebrew tree.
    const paths = pathsOf(await render("netzach"));
    const noted = paths.filter(({ text }) => text.includes("tree only"));
    expect(noted).toEqual([
      {
        text: "29 ק Qof to Malchut, The Moon · Hermetic tree only",
        hrefs: ["/kabbalah/path/7_10", "/kabbalah/sephirah/malchut"],
      },
    ]);
  });
});
