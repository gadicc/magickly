import { describe, expect, it } from "vitest";
import data from "./data";

/**
 * What a row of each table looks like from the outside: the fields as
 * authored, plus the links [assemble()](./assemble.ts) puts on it. Step 0
 * pinned this against the barrel's in-place mutation; step 2 replaced that
 * mutation, and this is the delta, table by table.
 *
 * Two tables are new, `gdDegree` and `tribeOfIsrael`, both of them link
 * targets the barrel never held. The barrel is 23 of the 26 tables:
 * `seventyTwoAngel`, `enochianTablet` and `christianChoir` declare no link in
 * either direction, so assembling them would add nothing to any row and only
 * put their JSON in every barrel route's chunk ([data.ts](./data.ts)).
 *
 * The old `insertRefs` did recurse into nested blocks, so these are the
 * accessors it made and which are now an own key of every row of the table
 * rather than only of the rows that carried the id: `planet.hebrewLetter`,
 * `godName` and `archangel`; `gdGrade.element`, `planet` and `sephirah`;
 * `archangel.sephirah`; `alchemySymbol.planet`; and `hebrewLetter` inside
 * `tolPath`'s `hermetic` and `hebrew` blocks. What is genuinely new is:
 *
 * - `planet.sephirot`, `element.tetragrams` and `element.zodiacs`, derived
 *   back-links nobody hand-maintains.
 * - `zodiac.tribeOfIsrael`, typed since 2023 and never made: the tribes were
 *   not in the barrel.
 * - `house.zodiac`: the astrology houses are an array, which `insertRefs`
 *   skipped entirely.
 * - `tetragram.planets`, a list of ids, which the `Id` rule could not see.
 * - `gdGrade.degree`, because `gd/degrees.json5` is a table now.
 * - `next` and `prev` on `gdGrade`, `sephirah` and `tolPath`: a field naming
 *   its own table is invisible to a rule that reads field names.
 *
 * Nothing is lost, and every accessor is on every row of its table, holding
 * `undefined` where the row has no id: Keter's `prev` below is the first of
 * those.
 *
 * Plan 036 derived the back-links its entity pages read: the planet's
 * `alchemySymbol`, `gdGrade`, `tetragrams` and `zodiacs`, and the letter's
 * `planet`, `hermeticPath` and `hebrewPath`, with no JSON touched.
 * Back-links follow a row's own links, in the order of the names of the
 * tables that declare them, so the planet's four fall either side of
 * `sephirot` rather than after it. A path also names its two sephirot now,
 * `fromId` and `toId` in the JSON with `from` and `to` beside them, and the
 * sephirah derives `pathsFrom` and `pathsTo` from those.
 *
 * The sampled row is each table's first, named so the sample is reproducible;
 * for the one array table left in the barrel that is index `0`.
 */
const SAMPLE: Record<string, { row: string; keys: string[] }> = {
  planet: {
    row: "primum-mobile",
    keys: [
      "id",
      "kind",
      "name",
      "hebrewLetter",
      "godName",
      "archangel",
      "alchemySymbol",
      "gdGrade",
      "sephirot",
      "tetragrams",
      "zodiacs",
    ],
  },
  zodiac: {
    row: "aries",
    keys: [
      "id",
      "no",
      "symbol",
      "emoji",
      "name",
      "meaning",
      "rulesFrom",
      "planetId",
      "elementId",
      "quadruplicity",
      "tribeOfIsraelId",
      "tetragrammatonPermutation",
      "planet",
      "element",
      "tribeOfIsrael",
    ],
  },
  house: {
    row: "0",
    keys: ["index", "zodiacId", "motto", "name", "interpretation", "zodiac"],
  },
  hebrewLetter: {
    row: "alef",
    keys: [
      "id",
      "letter",
      "index",
      "value",
      "meaning",
      "planet",
      "hermeticPath",
      "hebrewPath",
    ],
  },
  enochianLetter: {
    row: "A",
    keys: [
      "id",
      "enochian",
      "title",
      "english",
      "pronounciation",
      "planet/element",
      "tarot",
      "gematria",
    ],
  },
  tetragram: {
    row: "acquisitio",
    keys: [
      "id",
      "rows",
      "title",
      "translation",
      "meaning",
      "meanings",
      "zodiacId",
      "elementId",
      "planetIds",
      "rulerIds",
      "zodiac",
      "element",
      "planets",
    ],
  },
  geomanicHouse: { row: "1", keys: ["id", "meaning"] },
  gdGrade: {
    row: "0=0",
    keys: [
      "id",
      "name",
      "orderId",
      "degreeId",
      "nextId",
      "element",
      "planet",
      "sephirah",
      "degree",
      "next",
      "prev",
    ],
  },
  gdDegree: { row: "1st", keys: ["id", "pillarId"] },
  archangel: {
    row: "cassiel",
    keys: ["id", "name", "planetId", "planet", "sephirah"],
  },
  angelicOrder: { row: "chayot-hakodesh", keys: ["name"] },
  fourWorlds: {
    row: "atzilut",
    keys: ["id", "name", "desc", "residentsTitle"],
  },
  godName: { row: "ehiyeh", keys: ["name"] },
  kerub: {
    row: "earth",
    keys: ["id", "title", "face", "zodiacId", "elementId", "zodiac", "element"],
  },
  sephirah: {
    row: "keter",
    keys: [
      "index",
      "id",
      "name",
      "color",
      "chakraId",
      "godNameId",
      "scent",
      "body",
      "bodyPos",
      "planetId",
      "tenHeavens",
      "stone",
      "archangelId",
      "soulId",
      "angelicOrderId",
      "gdGradeId",
      "nextId",
      "chakra",
      "godName",
      "planet",
      "archangel",
      "soul",
      "angelicOrder",
      "gdGrade",
      "next",
      "prev",
      "pathsFrom",
      "pathsTo",
    ],
  },
  tolPath: {
    row: "1_2",
    keys: [
      "id",
      "fromId",
      "toId",
      "hermetic",
      "hebrew",
      "nextId",
      "from",
      "to",
      "next",
      "prev",
    ],
  },
  soul: { row: "yechidah", keys: ["id", "name"] },
  tribeOfIsrael: { row: "reuben", keys: ["id", "name"] },
  chakra: {
    row: "root",
    keys: [
      "id",
      "name",
      "meaning",
      "location",
      "petals",
      "color",
      "seed",
      "seedMeaning",
    ],
  },
  alchemySymbol: {
    row: "sulphur",
    keys: [
      "id",
      "symbol",
      "altSymbol",
      "name",
      "category",
      "gdGrade",
      "planet",
    ],
  },
  alchemyTerm: {
    row: "sol-philosophorum",
    keys: ["id", "name", "terms", "gdGrade"],
  },
  element: {
    row: "earth",
    keys: [
      "id",
      "symbol",
      "name",
      "elementalId",
      "elemental",
      "tetragrams",
      "zodiacs",
    ],
  },
  elemental: {
    row: "gnome",
    keys: ["id", "name", "namePlural", "title", "elementId", "element"],
  },
};

/** The first entry of a table, by key, for arrays and objects alike. */
function sample(table: unknown) {
  const [row, value] = Object.entries(table as object)[0];
  return { row, keys: Object.keys(value ?? {}) };
}

describe("data barrel", () => {
  it("exports the tables the app imports by name", () => {
    expect(Object.keys(data)).toEqual(Object.keys(SAMPLE));
  });

  it("shows the enumerable surface of a row of every table", () => {
    const actual = Object.fromEntries(
      Object.entries(data).map(([name, table]) => [name, sample(table)]),
    );
    expect(actual).toEqual(SAMPLE);
  });

  it("gives a row with no ids the accessors anyway, holding nothing", () => {
    // Da'at is the sharpest case: it is not a sephirah of the Tree and has
    // almost none of the links, and every one of them is still a key.
    const daat = data.sephirah.daat;
    expect(Object.keys(daat)).toEqual([
      "index",
      "id",
      "name",
      "color",
      "godNameId",
      "scent",
      "body",
      "bodyPos",
      "stone",
      "chakra",
      "godName",
      "planet",
      "archangel",
      "soul",
      "angelicOrder",
      "gdGrade",
      "next",
      "prev",
      "pathsFrom",
      "pathsTo",
    ]);
    expect(daat.planet).toBeUndefined();
    expect(daat.pathsFrom).toEqual([]);
    expect(daat.godName?.name.he).toBe("יהוה אלוהים");
  });

  it("puts a nested accessor at the nesting level of its id", () => {
    expect(Object.keys(data.tolPath["1_2"].hermetic ?? {})).toEqual([
      "hebrewLetterId",
      "pathNo",
      "tarotId",
      "hebrewLetter",
    ]);
    expect(Object.keys(data.tolPath["1_2"].hebrew ?? {})).toEqual([
      "hebrewLetterId",
      "hebrewLetter",
    ]);
  });
});
