import { describe, expect, it } from "vitest";
import data from "./data";

/**
 * What a row of each table looks like from the outside: the fields as
 * authored, plus the links [assemble()](./assemble.ts) puts on it. Step 0
 * pinned this against the barrel's in-place mutation; step 2 replaced that
 * mutation, and this is the delta, table by table.
 *
 * Five tables are new — `enochianTablet`, `gdDegree`, `christianChoir`,
 * `tribeOfIsrael` and `seventyTwoAngel` — because the barrel now holds every
 * table but the Enochian dictionary and the Keys. Of the rest:
 *
 * - `planet` gains `hebrewLetter`, `godName` and `archangel`, which the
 *   mutation only made for rows that had the ids, and `sephirot`, derived.
 * - `zodiac` gains `tribeOfIsrael`, a link that was typed and never made.
 * - `house` gains `zodiac`: the astrology houses are an array, which the
 *   mutation skipped entirely.
 * - `tetragram` gains `planets`, a list the `Id` rule could not see.
 * - `gdGrade` gains `element`, `planet`, `sephirah` and `degree` — the last
 *   because `gd/degrees.json5` is a table now — and `next` and `prev`.
 * - `archangel` gains `sephirah`, a back-link the data stores both ways.
 * - `sephirah`, `tolPath` and `gdGrade` gain `next` and `prev`, which name
 *   their own table and so were invisible to a rule reading field names.
 * - `element` gains `tetragrams` and `zodiacs`, derived.
 * - `alchemySymbol` gains `planet`.
 * - `tolPath`'s `hermetic` and `hebrew` blocks gain `hebrewLetter` inside
 *   them, at the nesting level of the id.
 *
 * Nothing is lost, and every accessor is on every row of its table, holding
 * `undefined` where the row has no id: Keter's `prev` below is the first of
 * those.
 *
 * The sampled row is each table's first, named so the sample is reproducible;
 * for the three array tables that is index `0`.
 */
const SAMPLE: Record<string, { row: string; keys: string[] }> = {
  planet: {
    row: "primum-mobile",
    keys: ["id", "name", "hebrewLetter", "godName", "archangel", "sephirot"],
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
    keys: ["id", "letter", "index", "value", "meaning"],
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
  enochianTablet: { row: "earth", keys: ["id", "grid"] },
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
  christianChoir: { row: "0", keys: ["id", "name"] },
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
    ],
  },
  tolPath: {
    row: "1_2",
    keys: ["id", "hermetic", "hebrew", "nextId", "next", "prev"],
  },
  soul: { row: "yechidah", keys: ["id", "name"] },
  tribeOfIsrael: { row: "reuben", keys: ["id", "name"] },
  seventyTwoAngel: {
    row: "0",
    keys: [
      "no",
      "name",
      "printedPages",
      "attribute",
      "people",
      "godName",
      "psalm",
      "invokedFor",
      "governs",
      "bornUnder",
      "contrary",
    ],
  },
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
    ]);
    expect(daat.planet).toBeUndefined();
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
