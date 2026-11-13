import Data from "magick-data";
import { ANGEL_COUNT } from "magick-data/kabbalah/seventyTwoAngels/derived";
import { describe, expect, it } from "vitest";
import {
  angelPage,
  entityIds,
  entityPages,
  gradePage,
  isHiddenSephirah,
  pathPage,
  planetPage,
  sephirahPage,
} from "./entities";
import { PUBLIC_PAGES } from "./pages";

describe("entity pages", () => {
  it("describes a planet with the correspondences that fit", () => {
    expect(planetPage("saturn")).toEqual({
      path: "/astrology/planet/saturn",
      title: "Saturn ♄ Correspondences",
      description:
        "Correspondences of Saturn (Hebrew שַׁבְּתַאי, Shabbathai): symbol ♄, " +
        "day Saturday, rules Capricorn and Aquarius, letter Tav, god name " +
        "YHVH Elohim.",
    });
    // Luna's god name arrived with its id's spelling fix (plans/032).
    expect(planetPage("luna")?.description).toBe(
      "Correspondences of the Moon (Luna, Hebrew לבנה, Levanah): symbol ☾, " +
        "day Monday, rules Cancer, letter Gimel, god name Shaddai El Chai, " +
        "archangel Gavriel.",
    );
  });

  it("gives a row's own description where it has one", () => {
    // Plan 078: the eight thin rows; the title stays the correspondences'.
    expect(planetPage("primum-mobile")).toMatchObject({
      title: "Primum Mobile Correspondences",
      description:
        "Primum Mobile, Roshit HaGilgulim: the heaven of Keter, first of the ten heavens of the sephirot, and the ten listed in order from Keter to Malchut.",
    });
    expect(planetPage("earth")?.description).toBe(
      "Earth ♁ in the Golden Dawn: Malchut, the sphere of the elements and the Zelator grade, 1=10, and why astrology gives the Earth no sign and no day.",
    );
    const own = Object.values(Data.planet).filter(
      (planet) => planet.description,
    );
    expect(own.map((planet) => planet.id)).toEqual([
      "primum-mobile",
      "zodiac",
      "olam-yesodot",
      "earth",
      "uranus",
      "neptune",
      "rahu",
      "ketu",
    ]);
    for (const planet of own)
      expect(planetPage(planet.id)?.description, planet.id).toBe(
        planet.description?.en,
      );
  });

  it("leads with the name readers search for, where a planet has one", () => {
    expect(planetPage("sol")).toMatchObject({
      path: "/astrology/planet/sol",
      title: "Sun (Sol) ☉ Correspondences",
    });
    expect(planetPage("sol")?.description).toMatch(
      /^Correspondences of the Sun \(Sol, Hebrew שמש, Shemesh\): symbol ☉, day Sunday, rules Leo, /,
    );
    expect(planetPage("rahu")).toMatchObject({
      title: "North Node (Caput Draconis) ☊ Correspondences",
      description:
        "The North Node, Caput Draconis ☊: the Dragon’s Head, one of the two points where eclipses happen; favourable like Jupiter and Venus, and Rahu in Sanskrit.",
    });
    expect(planetPage("mercury")?.description).toMatch(
      /^Correspondences of Mercury \(Hebrew כוכב, Kochav\): symbol ☿, day Wednesday, rules Gemini and Virgo, /,
    );
  });

  it("knows every common name, since each is given the article “the”", () => {
    // A new common name may not take one: check its description, then add it.
    expect(
      Object.values(Data.planet).flatMap((planet) =>
        planet.commonName ? [planet.commonName] : [],
      ),
    ).toEqual(["Sun", "Moon", "North Node", "South Node"]);
  });

  it("gives every planet and sphere a description of a snippet's length", () => {
    // Long enough to say what the page holds, short enough not to be cut.
    const ids = Object.keys(Data.planet);
    expect(ids).toHaveLength(15);
    for (const id of ids) {
      const { length } = planetPage(id)?.description ?? "";
      expect(length, id).toBeGreaterThanOrEqual(110);
      expect(length, id).toBeLessThanOrEqual(160);
    }
  });

  it("describes grades with and without a Sephirah", () => {
    expect(gradePage("1=10")).toEqual({
      path: "/gd/grade/1=10",
      title: "Zelator 1=10 Grade",
      description:
        "The Zelator 1=10 grade of the Golden Dawn's First Order, attributed " +
        "to Malchut on the Tree of Life and the element of Earth, with its " +
        "correspondences.",
    });
    expect(gradePage("portal")).toMatchObject({
      title: "Portal Grade",
      description:
        "The Portal grade of the Golden Dawn and the element of Spirit, " +
        "between Philosophus 4=7 and Adeptus Minor 5=6, with its " +
        "correspondences.",
    });
    // The neighbours where they fit, so the grades with least to say still
    // fill a snippet.
    expect(gradePage("0=0")?.description).toBe(
      "The Neophyte 0=0 grade of the Golden Dawn's First Order, the grade of " +
        "entry, before Zelator 1=10, with its correspondences.",
    );
    expect(gradePage("10=1")?.description).toBe(
      "The Ipsissimus 10=1 grade of the Golden Dawn's Third Order, attributed " +
        "to Keter on the Tree of Life, the last grade, after Magus 9=2, with " +
        "its correspondences.",
    );
  });

  it("describes Sephiroth, including Da'at", () => {
    expect(sephirahPage("keter")).toEqual({
      path: "/kabbalah/sephirah/keter",
      title: "Keter (Crown) on the Tree of Life",
      description:
        'Keter (כתר), "Crown", is Sephirah 1 of the Tree of Life: god name ' +
        "Ehiyeh, archangel Metatron, angelic host Chayot HaKodesh, King and " +
        "Queen scale colours.",
    });
    expect(sephirahPage("malchut")?.description).toContain(
      "archangel Sandalphon",
    );
    // The table numbers Da'at 11; the Tree does not (plan 036, decision 18).
    // Only the description says so: the title is as it was. Da'at has a
    // Queen scale and no King scale, so the description promises the one.
    expect(sephirahPage("daat")).toEqual({
      path: "/kabbalah/sephirah/daat",
      title: "Da'at (Knowledge) on the Tree of Life",
      description:
        'Da\'at (דעת), "Knowledge", is the hidden Sephirah of the Tree of ' +
        "Life: god name YHVH Elohim, Queen scale colour.",
    });
  });

  it("finds the hidden Sephirah by the chain, and only Da'at", () => {
    // Outside the chain is the criterion, so it must pick out exactly one
    // sphere, and the one the description and the page call hidden.
    expect(
      Object.values(Data.sephirah)
        .filter(isHiddenSephirah)
        .map((sephirah) => sephirah.id),
    ).toEqual(["daat"]);
  });

  it("drops the fields that would overflow a snippet", () => {
    // The colours would take Binah's description past 160 characters.
    expect(sephirahPage("binah")?.description).toBe(
      'Binah (בינה), "Understanding", is Sephirah 3 of the Tree of Life: god ' +
        "name YHVH Elohim, archangel Tzaphkiel, angelic host Ar'aleem.",
    );
  });

  it("describes Hermetic and Hebrew-only paths", () => {
    expect(pathPage("1_2")).toEqual({
      path: "/kabbalah/path/1_2",
      title: "Tree of Life Path 11: Keter–Chochmah",
      description:
        "Path 11 of the Tree of Life joins Keter and Chochmah. Hermetic " +
        'attribution: the letter Aleph (א, "ox") and The Fool; Hebrew ' +
        "attribution: He.",
    });
    // The trump as its Rider–Waite card prints it, as the page names it:
    // tarot-deck's "The Papess/High Priestess" is two decks at once.
    expect(pathPage("1_6")?.description).toBe(
      "Path 13 of the Tree of Life joins Keter and Tiferet. Hermetic " +
        'attribution: the letter Gimel (ג, "camel") and The High Priestess; ' +
        "Hebrew attribution: Dalet.",
    );
    expect(pathPage("8_10")?.description).toBe(
      "Path 31 of the Tree of Life joins Hod and Malchut. Hermetic " +
        'attribution: the letter Shin (ש, "tooth") and Judgement.',
    );
    expect(pathPage("2_5")).toEqual({
      path: "/kabbalah/path/2_5",
      title: "Tree of Life Path Chochmah–Gevurah",
      description:
        "The path joining Chochmah and Gevurah exists only on the Hebrew " +
        "Tree of Life, where it carries the letter Zayin; the Hermetic tree " +
        "omits it.",
    });
  });

  it("gives an angel's meaning, which searchers ask for by name", () => {
    expect(angelPage("vehuiah")?.description).toBe(
      "Vehuiah (והויה), the 1st angel of the Shem HaMephorash: meaning " +
        '"God elevated and exalted above all things", rules the Hebrews, ' +
        "god name Jehovah, psalm 3:3.",
    );
    // An angel with less to say gains its degrees of the zodiac, and loses
    // the full stop Lenain ends its attribute with.
    expect(angelPage("sitael")?.description).toBe(
      "Sitaël (סיטאל), the 3rd angel of the Shem HaMephorash: meaning " +
        '"God, the hope of all creatures", psalm 90:2, 11–15° of Aries.',
    );
  });

  it("rejects unknown and inherited ids", () => {
    for (const lookup of [planetPage, gradePage, sephirahPage, pathPage]) {
      expect(lookup("missing")).toBeNull();
      expect(lookup("constructor")).toBeNull();
    }
  });

  it("lists one page per row with unique, sized copy", () => {
    const pages = entityPages();
    const routes = ["planet", "gdGrade", "sephirah", "treeOfLifePath"] as const;
    expect(pages).toHaveLength(
      routes.reduce((sum, kind) => sum + entityIds(kind).length, 0) +
        ANGEL_COUNT,
    );
    const publicTitles = Object.values(PUBLIC_PAGES).map((page) => page.title);
    const titles = new Set([
      ...pages.map((page) => page.title),
      ...publicTitles,
    ]);
    expect(titles.size).toBe(pages.length + publicTitles.length);
    expect(new Set(pages.map((page) => page.path)).size).toBe(pages.length);
    for (const page of pages) {
      expect(page.title.length, page.path).toBeLessThanOrEqual(48);
      // Bing reports a description under 110 characters as too short.
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(110);
      expect(page.description.length, page.path).toBeLessThanOrEqual(160);
      expect(page.description, page.path).not.toMatch(/undefined/);
    }
  });

  it("exposes static params by data set", () => {
    expect(entityIds("gdGrade")).toContainEqual({ id: "portal" });
    expect(entityIds("sephirah")).toHaveLength(11);
    expect(entityIds("treeOfLifePath")).toHaveLength(24);
  });
});
