import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Data from "@/../data/data";
import {
  expectEntityPage,
  hrefsOf,
  textOf,
} from "../../../../../tests/entityPage";
import Planet from "./page";

// The spirit sigils are SVG imports: components under SVGR, data URLs under
// vitest, which React refuses as a tag name. The stand-in renders the id it
// was given, so a page can still be held to drawing the right spirit's.
vi.mock("@/components/astrology/planetarySpirits", () => ({
  default: ({
    id,
    "aria-hidden": hidden,
  }: {
    id: string;
    "aria-hidden"?: boolean;
  }) => `[sigil of ${id}${hidden ? ", hidden" : ""}]`,
}));

/**
 * The planet page, laid out from its row (plan 036, "Planet").
 *
 * It used to print the row as JSON, `kind` and all. Every id is rendered
 * through the route, as the site serves it, and held to what every entity
 * page must hold; the cases below then read what a reader sees, row by row,
 * by the text of each label and its value.
 */

const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});

async function page(id: string) {
  return renderToString(await Planet(props(id)));
}

/** The table's labels, in the order the page renders them. */
const LABELS = [
  "Symbol",
  "Hebrew letter",
  "Path",
  "Sephirah",
  "God name",
  "Archangel",
  "Intelligence",
  "Spirit",
  "Rules",
  "Geomantic figures",
  "Grade",
  "Magical operations",
];

/** Each table row's label, and its value as text and as markup. */
function rowsOf(html: string) {
  return [
    ...html.matchAll(
      /<tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g,
    ),
  ].map(([, label, value]) => ({
    label: textOf(label),
    text: textOf(value),
    hrefs: hrefsOf(value),
  }));
}

function row(html: string, label: string) {
  const found = rowsOf(html).find((each) => each.label === label);
  expect(found, `the ${label} row`).toBeDefined();
  return found as NonNullable<typeof found>;
}

const SATURN =
  "The classical correspondences stop at Saturn, the last of the seven planets of antiquity, so this page has only its symbol.";

const ids = Object.keys(Data.planet);

describe("the planet page", () => {
  it("holds every planet and sphere to what every entity page must hold", async () => {
    for (const id of ids) {
      const planet = Data.planet[id as keyof typeof Data.planet];
      const html = await page(id);
      expectEntityPage(
        html,
        planet.symbol
          ? `${planet.name.en.en} ${planet.symbol}`
          : planet.name.en.en,
      );
      // The dump printed `kind` as a row; its labels are now these, in this
      // order, and nothing else.
      const labels = rowsOf(html).map((each) => each.label);
      expect(labels, id).toEqual(
        LABELS.filter((label) => labels.includes(label)),
      );
      expect(html, id).not.toMatch(/>kind</);
    }
  });

  it("shows Sol's every correspondence, linked where it has a page", async () => {
    // Sol has a row for every label, so it is the one case that reads them
    // all, and the plan's sketch is drawn from it.
    const html = await page("sol");
    expect(rowsOf(html).map((each) => each.label)).toEqual(LABELS);
    expect(textOf(html)).toContain("In Hebrew שמש, Shemesh, “Sun”");

    expect(row(html, "Symbol").text).toBe("☉ · alchemical 🜚 Gold");
    expect(row(html, "Hebrew letter").text).toBe("ר Resh · 200 · “head”");
    expect(row(html, "Path")).toMatchObject({
      text: "30, Hod – Yesod, The Sun",
      hrefs: ["/kabbalah/path/8_9"],
    });
    expect(row(html, "Sephirah")).toMatchObject({
      text: "Tiferet",
      hrefs: ["/kabbalah/sephirah/tiferet"],
    });
    expect(row(html, "God name").text).toBe(
      "יהוה אלוה ודעת YHVH Eloah Ve-da'at “Lord God of Knowledge”",
    );
    expect(row(html, "Archangel").text).toBe("מיכאל Michael");
    expect(row(html, "Intelligence").text).toBe("Nakhiel");
    // The sigil is decoration beside the name, hidden from a screen reader.
    expect(row(html, "Spirit").text).toBe("Sorath [sigil of sorath, hidden]");
    expect(row(html, "Rules").text).toBe("♌︎ Leo");
    expect(row(html, "Geomantic figures")).toMatchObject({
      text: "Fortuna Major, Fortuna Minor",
      hrefs: ["/geomancy/reference"],
    });
    expect(row(html, "Grade")).toMatchObject({
      text: "5=6 Adeptus Minor",
      hrefs: ["/gd/grade/5=6"],
    });
    // Decision 3: shown, and said to be unsourced.
    const operations = row(html, "Magical operations").text;
    expect(operations).toMatch(/^Career success and progression, /);
    expect(operations).toMatch(
      / An editorial summary; its source is not recorded\.$/,
    );
  });

  it("lists every sign a planet rules", async () => {
    // Mercury rules two signs, and the plan names it: the row is the whole
    // back-link, not its first sign.
    expect(row(await page("mercury"), "Rules").text).toBe(
      "♊︎ Gemini, ♍︎ Virgo",
    );
  });

  it("lists every figure that names a planet", async () => {
    // Cauda Draconis names Mars and Saturn both, so Mars's three include a
    // figure it shares, which a list link's back-link has to find.
    expect(row(await page("mars"), "Geomantic figures").text).toBe(
      "Cauda Draconis, Puer, Rubeus",
    );
  });

  it("shows Luna's god name, the one the route test pins", async () => {
    const html = await page("luna");
    expect(row(html, "God name").text).toBe(
      "שדאי אל חי Shaddai El Chai “Almighty Living God”",
    );
    // Gabriel is the one archangel with an English form of the name, which
    // is not a meaning and is not quoted as one.
    expect(row(html, "Archangel").text).toBe("גבריאל Gavriel");
  });

  it("gives Earth its symbol and its grade and no more", async () => {
    // Earth has no letter and no Hebrew name, only the grade that is
    // attributed to it, Zelator's.
    const html = await page("earth");
    expect(rowsOf(html)).toEqual([
      { label: "Symbol", text: "♁", hrefs: [] },
      { label: "Grade", text: "1=10 Zelator", hrefs: ["/gd/grade/1=10"] },
    ]);
    expect(textOf(html)).not.toContain("In Hebrew");
    expect(textOf(html)).not.toContain(SATURN);
  });

  it("says why Uranus has only its symbol", async () => {
    // Decision 4: the page stays, and says the classical attributions stop
    // at Saturn rather than showing a table with nothing in it.
    const html = await page("uranus");
    expect(textOf(html)).toContain(SATURN);
    expect(rowsOf(html)).toEqual([{ label: "Symbol", text: "⛢", hrefs: [] }]);
  });

  it("says so on the four with nothing but a name and a symbol, and no others", async () => {
    // The page says it of a row with nothing else, not of a list of ids, so
    // this is what holds it to those four and keeps it off Earth's.
    const said: string[] = [];
    for (const id of ids)
      if (textOf(await page(id)).includes(SATURN)) said.push(id);
    expect(said).toEqual(["uranus", "neptune", "rahu", "ketu"]);
  });

  it("names a sphere's sephirah in its lede, and draws no table", async () => {
    // The three spheres are the sephirot's `planet` and have nothing but a
    // name; the inverse that already existed gives each its sephirah.
    const html = await page("primum-mobile");
    expect(textOf(html)).toContain(
      "The sphere of Keter, in Hebrew ראשית הגלגולים, Roshit HaGilgulim",
    );
    expect(hrefsOf(html)).toContain("/kabbalah/sephirah/keter");
    expect(html).not.toContain("<table");
    expect(hrefsOf(html)).not.toContain("/astrology/planetary-hours");

    for (const [id, sephirah] of [
      ["zodiac", "chochmah"],
      ["olam-yesodot", "malchut"],
    ])
      expect(hrefsOf(await page(id)), id).toContain(
        `/kabbalah/sephirah/${sephirah}`,
      );
  });

  it("loses nothing by drawing no table for a sphere", () => {
    // A sphere's page is its heading and its lede; were a sphere to gain a
    // correspondence, this is what would say the page must show it.
    const spheres = Object.values(Data.planet).filter(
      (planet) => planet.kind === "sphere",
    );
    expect(spheres.map((sphere) => sphere.id)).toEqual([
      "primum-mobile",
      "zodiac",
      "olam-yesodot",
    ]);
    for (const sphere of spheres)
      expect(
        Object.entries(sphere)
          .filter(
            ([, value]) =>
              value !== undefined &&
              !(Array.isArray(value) && value.length === 0),
          )
          .map(([key]) => key),
        sphere.id,
      ).toEqual(["id", "kind", "name", "sephirot"]);
  });

  it("links the planetary hours from the seven planets they are kept for", async () => {
    // The hours cycle through the seven in the Chaldean order; the other
    // eight rows have none.
    const linked: string[] = [];
    for (const id of ids)
      if (hrefsOf(await page(id)).includes("/astrology/planetary-hours"))
        linked.push(id);
    expect(linked).toEqual([
      "sol",
      "mercury",
      "venus",
      "luna",
      "mars",
      "jupiter",
      "saturn",
    ]);
  });
});
