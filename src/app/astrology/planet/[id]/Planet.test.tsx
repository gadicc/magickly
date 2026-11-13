import Data from "magick-data";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { planetName } from "@/components/astrology/planetName";
import {
  expectEntityPage,
  hrefsOf,
  textOf,
} from "../../../../../tests/entityPage";
import Planet from "./page";

// The stand-in for the spirit sigils renders the id it was given, so a page
// can be held to drawing the right spirit's without its path data.
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
  "Day",
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
  "Key of Solomon",
];

/**
 * Each entity table row's label, and its value as text and as markup; the
 * ten heavens' row headers are not among them.
 */
function rowsOf(html: string) {
  const table = html.replace(
    /<section aria-labelledby="ten-heavens">[\s\S]*?<\/section>/,
    "",
  );
  return [
    ...table.matchAll(
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

/** The paragraph after the heading: the lede, where the page has one. */
function ledeOf(html: string) {
  const found = html.match(/<\/h1><p class="[^"]*lede[^"]*">([\s\S]*?)<\/p>/);
  return found ? textOf(found[1]) : null;
}

/** The "See also" line's links, as [href, text]. */
function seeAlsoOf(html: string) {
  const line = html.match(/<p class="[^"]*seeAlso[^"]*">([\s\S]*?)<\/p>/)?.[1];
  return [...(line ?? "").matchAll(/href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href, text]) => [href, textOf(text)],
  );
}

/**
 * The ten heavens' rows: the symbol slot's text, the heaven, where it links
 * (null for this page's own, which is marked current instead), the sephirah
 * and where it links.
 */
function heavensOf(html: string) {
  const section = html.match(
    /<section aria-labelledby="ten-heavens">([\s\S]*?)<\/section>/,
  )?.[1];
  if (!section) return null;
  return [
    ...section.matchAll(
      /<tr><th scope="row">([\s\S]*?)<\/th><td>([\s\S]*?)<\/td><\/tr>/g,
    ),
  ].map(([, heaven, sephirah]) => {
    const slot = heaven.match(
      /^<span class="[^"]*symbol[^"]*" aria-hidden="true">([^<]*)<\/span>/,
    );
    // The Hebrew under the name, kept apart from it.
    const hebrew = heaven.match(/<span class="[^"]*hebrew[^"]*">[\s\S]*$/);
    const name = heaven.slice(slot?.[0].length ?? 0, hebrew?.index);
    return {
      symbol: slot ? slot[1] : "(no slot)",
      heaven: textOf(name),
      hebrew: hebrew ? textOf(hebrew[0]) : null,
      href: hrefsOf(heaven)[0] ?? null,
      current: heaven.includes('aria-current="page"'),
      sephirah: textOf(sephirah),
      sephirahHref: hrefsOf(sephirah)[0],
    };
  });
}

const ids = Object.keys(Data.planet);

/** The rows with a text of their own (plan 078), in the table's order. */
const ABOUT = [
  "primum-mobile",
  "zodiac",
  "olam-yesodot",
  "earth",
  "uranus",
  "neptune",
  "rahu",
  "ketu",
];

describe("the planet page", () => {
  it("holds every planet and sphere to what every entity page must hold", async () => {
    for (const id of ids) {
      const planet = Data.planet[id as keyof typeof Data.planet];
      const html = await page(id);
      expectEntityPage(
        html,
        planet.symbol
          ? `${planetName(planet)} ${planet.symbol}`
          : planetName(planet),
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
    // The gloss “Sun” is left out: the heading already says it.
    expect(textOf(html)).toContain("In Hebrew שמש, Shemesh.");

    expect(row(html, "Symbol").text).toBe("☉ · alchemical 🜚 Gold");
    expect(row(html, "Day").text).toBe("Sunday");
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
      "יהוה אלוה ודעת YHVH Eloah VeDa'at “Lord God of Knowledge”",
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
    // Mathers' sentence verbatim, quoted and cited (plan 039, after the
    // owner's review).
    expect(row(html, "Key of Solomon").text).toBe(
      "“The Days and Hours of the Sun are very good for perfecting experiments regarding temporal wealth, hope, gain, fortune, divination, the favour of princes, to dissolve hostile feeling, and to make friends.” Mathers' translation (1888), Book I, chapter II.",
    );
  });

  it("leads with the name readers search for, where the row has one", async () => {
    // The heading and the breadcrumb both; the URL and the id stay Sol's.
    const heading = (html: string) =>
      textOf(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
    const html = await page("sol");
    expect(heading(html)).toBe("Sun (Sol) ☉");
    expect(html).toContain('"name":"Sun (Sol)"');
    expect(heading(await page("rahu"))).toBe("North Node (Caput Draconis) ☊");
    expect(heading(await page("ketu"))).toBe("South Node (Cauda Draconis) ☋");
    expect(heading(await page("mercury"))).toBe("Mercury ☿");
    // Luna's gloss is not her common name, so it stays.
    const luna = await page("luna");
    expect(heading(luna)).toBe("Moon (Luna) ☾");
    expect(textOf(luna)).toContain("In Hebrew לבנה, Levanah, “White”.");
  });

  it("gives the seven planets their day, and no other row", async () => {
    // The days the planetary hours begin from, Sunday the Sun's.
    const days: Record<string, string> = {};
    for (const id of ids) {
      const found = rowsOf(await page(id)).find((each) => each.label === "Day");
      if (found) days[id] = found.text;
    }
    expect(days).toEqual({
      sol: "Sunday",
      mercury: "Wednesday",
      venus: "Friday",
      luna: "Monday",
      mars: "Tuesday",
      jupiter: "Thursday",
      saturn: "Saturday",
    });
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

  it("gives Earth its text, its symbol and its grade and no more", async () => {
    // Earth has no letter and no Hebrew name, only the grade that is
    // attributed to it, Zelator's.
    const html = await page("earth");
    expect(rowsOf(html)).toEqual([
      { label: "Symbol", text: "♁", hrefs: [] },
      { label: "Grade", text: "1=10 Zelator", hrefs: ["/gd/grade/1=10"] },
    ]);
    expect(ledeOf(html)).toMatch(
      /^In the Golden Dawn the Earth answers to Malchut, the tenth sephirah, /,
    );
    expect(textOf(html)).not.toContain("In Hebrew");
  });

  it("leads with a row's own text where it has one, and only there", async () => {
    // Plan 078: the eight thin pages, as the owner accepted them.
    const led: string[] = [];
    for (const id of ids) {
      const planet = Data.planet[id as keyof typeof Data.planet];
      const lede = ledeOf(await page(id));
      if (!planet.about) continue;
      led.push(id);
      expect(lede, id).toBe(planet.about.en);
    }
    expect(led).toEqual(ABOUT);
    expect(ledeOf(await page("rahu"))).toBe(
      "The Dragon’s Head is the Moon’s north node, the point where the Moon’s path crosses the ecliptic going north; the south node, the Dragon’s Tail, lies opposite. Eclipses happen only when the Sun and Moon are near the nodes. Astrologers count the Head favourable, like Jupiter or Venus. In Sanskrit it is Rahu, the demon said to cause eclipses. The geomantic figure Caput Draconis carries its name.",
    );
    expect(ledeOf(await page("uranus"))).toMatch(
      /^William Herschel found Uranus on 13 March 1781 /,
    );
    // The seven planets keep their Hebrew names.
    expect(ledeOf(await page("saturn"))).toBe("In Hebrew שַׁבְּתַאי, Shabbathai.");
  });

  it("no longer says the correspondences stop at Saturn, of any row", async () => {
    // It was wrong for the nodes, and the moderns now say why themselves.
    for (const id of ids)
      expect(textOf(await page(id)), id).not.toContain("stop at Saturn");
    expect(rowsOf(await page("uranus"))).toEqual([
      { label: "Symbol", text: "⛢", hrefs: [] },
    ]);
  });

  it("links what a row's text names, under it", async () => {
    const seen: Record<string, string[][]> = {};
    for (const id of ids) {
      const links = seeAlsoOf(await page(id));
      if (links.length) seen[id] = links;
    }
    const hours = [["/astrology/planetary-hours", "Planetary hours"]];
    expect(seen).toEqual({
      sol: hours,
      mercury: hours,
      venus: hours,
      earth: [
        ["/kabbalah/sephirah/malchut", "Malchut"],
        ["/gd/grade/1=10", "Zelator"],
        ["/astrology/planet/olam-yesodot", "World of Foundations"],
        ["/enochian/tablets", "Enochian tablets"],
      ],
      luna: hours,
      mars: hours,
      jupiter: hours,
      saturn: hours,
      rahu: [
        ["/astrology/planet/ketu", "South Node (Cauda Draconis)"],
        ["/geomancy/reference", "Geomantic figures"],
      ],
      ketu: [
        ["/astrology/planet/rahu", "North Node (Caput Draconis)"],
        ["/geomancy/reference", "Geomantic figures"],
      ],
    });
  });

  it("lists the ten heavens on a sphere's page, Keter's to Malchut's", async () => {
    // From the sephirot's own `planet`, as the sephirah pages read it;
    // Da'at has none. Each symbol has a slot of its own before the name,
    // empty for a sphere, so the names line up.
    const heavens = heavensOf(await page("zodiac"));
    expect(heavens).toEqual(
      (
        [
          ["", "Primum Mobile", "primum-mobile", "Keter", "keter"],
          ["", "Zodiac", null, "Chochmah", "chochmah"],
          ["♄", "Saturn", "saturn", "Binah", "binah"],
          ["♃", "Jupiter", "jupiter", "Chesed", "hesed"],
          ["♂", "Mars", "mars", "Gevurah", "gevurah"],
          ["☉", "Sun (Sol)", "sol", "Tiferet", "tiferet"],
          ["♀", "Venus", "venus", "Netzach", "netzach"],
          ["☿", "Mercury", "mercury", "Hod", "hod"],
          ["☾", "Moon (Luna)", "luna", "Yesod", "yesod"],
          ["", "World of Foundations", "olam-yesodot", "Malchut", "malchut"],
        ] as const
      ).map(([symbol, heaven, id, sephirah, sephirahId]) => ({
        symbol,
        heaven,
        hebrew: expect.any(String),
        href: id && `/astrology/planet/${id}`,
        current: id === null,
        sephirah,
        sephirahHref: `/kabbalah/sephirah/${sephirahId}`,
      })),
    );

    // Each heaven's Hebrew under its name, so a sphere's page keeps its own.
    expect(heavens?.map((row) => row.hebrew)).toEqual(
      heavens?.map((row) => {
        const he = Object.values(Data.planet).find(
          (planet) => planetName(planet) === row.heaven,
        )?.name.he;
        return `${he?.he} ${he?.roman}`;
      }),
    );
    expect(heavens?.[9].hebrew).toBe("עולם היסודות Olam HaYesodot");

    // Each sphere's own row is the one marked current, and not a link.
    for (const id of ["primum-mobile", "zodiac", "olam-yesodot"]) {
      const rows = heavensOf(await page(id)) ?? [];
      const current = rows.filter((row) => row.current);
      expect(current, id).toHaveLength(1);
      expect(current[0].href, id).toBeNull();
      expect(current[0].heaven, id).toBe(
        planetName(Data.planet[id as keyof typeof Data.planet]),
      );
      expect(
        rows.filter((row) => row.href === null),
        id,
      ).toEqual(current);
    }
    // Under a heading of its own, which labels the section and the table,
    // and on no other page.
    expect(await page("zodiac")).toMatch(
      /<section aria-labelledby="ten-heavens"><h2 id="ten-heavens">The ten heavens<\/h2><table class="[^"]*" aria-labelledby="ten-heavens">/,
    );
    for (const id of ids)
      if (Data.planet[id as keyof typeof Data.planet].kind === "planet")
        expect(heavensOf(await page(id)), id).toBeNull();
  });

  it("links a sphere's sephirah from the ten heavens, and has no rows", async () => {
    // The three spheres are the sephirot's `planet` and have no
    // correspondences; the inverse gives each its sephirah.
    for (const [id, sephirah] of [
      ["primum-mobile", "keter"],
      ["zodiac", "chochmah"],
      ["olam-yesodot", "malchut"],
    ]) {
      const html = await page(id);
      const own = heavensOf(html)?.find((row) => row.current);
      expect(own?.sephirahHref, id).toBe(`/kabbalah/sephirah/${sephirah}`);
      expect(rowsOf(html), id).toEqual([]);
      expect(hrefsOf(html), id).not.toContain("/astrology/planetary-hours");
    }
  });

  it("loses nothing by drawing no table of correspondences for a sphere", () => {
    // A sphere's page is its heading, its text and the ten heavens; were a
    // sphere to gain a correspondence, this is what would say the page must
    // show it. Its `description` is the route's, its Hebrew name the text's.
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
      ).toEqual(["id", "kind", "name", "about", "description", "sephirot"]);
  });

  it("cites the Key of Solomon on the seven planets, and on no other row", async () => {
    // The Key gives the operations of the seven planets' days and hours; Earth,
    // the moderns, the nodes and the spheres have none, and `Row` omits the
    // label rather than printing it empty. Each row reads its own planet's
    // text, the one the planetary hours page shows.
    const cited: string[] = [];
    for (const id of ids) {
      const found = rowsOf(await page(id)).find(
        (each) => each.label === "Key of Solomon",
      );
      if (!found) continue;
      cited.push(id);
      const planet = Data.planet[id as keyof typeof Data.planet];
      expect(found.text, id).toContain(`“${planet.keyOfSolomon?.en}” `);
    }
    expect(cited).toEqual([
      "sol",
      "mercury",
      "venus",
      "luna",
      "mars",
      "jupiter",
      "saturn",
    ]);
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
