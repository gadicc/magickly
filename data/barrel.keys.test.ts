import { describe, expect, it } from "vitest";
import data from "./data";

/**
 * What a row of each table looks like from the outside: the fields as
 * authored, plus whatever [data.ts](./data.ts) linked into it in place. Plan
 * 032 renames and removes fields before replacing that mutation with an
 * assembled object, and each step has to show its delta here rather than
 * discover it later.
 *
 * The sampled row is each table's first, named so the sample is reproducible;
 * for the two array tables that is index `0`, which for the geomanic houses
 * is the `{}` that pads the array to one-based.
 */
const SAMPLE: Record<string, { row: string; keys: string[] }> = {
  planet: { row: "primum-mobile", keys: ["id", "name"] },
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
    ],
  },
  house: {
    row: "0",
    keys: ["index", "zodiacId", "motto", "name", "interpretation"],
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
    ],
  },
  geomanicHouse: { row: "0", keys: [] },
  gdGrade: {
    row: "0=0",
    keys: ["id", "name", "orderId", "degreeId", "nextId"],
  },
  archangel: { row: "cassiel", keys: ["id", "name", "planetId", "planet"] },
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
    ],
  },
  tolPath: { row: "1_2", keys: ["id", "hermetic", "hebrew", "nextId"] },
  soul: { row: "yechidah", keys: ["id", "name"] },
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
    keys: ["id", "symbol", "altSymbol", "name", "category", "gdGrade"],
  },
  alchemyTerm: {
    row: "sol-philosophorum",
    keys: ["id", "name", "terms", "gdGrade"],
  },
  element: {
    row: "earth",
    keys: ["id", "symbol", "name", "elementalId", "elemental"],
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
});
