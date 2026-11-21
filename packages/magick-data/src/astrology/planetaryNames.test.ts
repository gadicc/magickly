import { describe, expect, it } from "vitest";
import { schemas } from "../schemas.ts";
import { hebrewValue, letterValue } from "./aiqBekar.ts";
import { KAMEA_PLANETS } from "./kameas.ts";
import exceptions, {
  type PlanetaryNameException,
} from "./PlanetaryNameExceptions.ts";
import planetaryNames, {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryName,
  type PlanetaryNameReading,
  type PlanetaryNameWitness,
  readingOf,
  tracedSpelling,
} from "./PlanetaryNames.ts";
import planets from "./Planets.ts";

const names = Object.values(planetaryNames) as PlanetaryName[];
const exceptionRows = Object.values(exceptions) as PlanetaryNameException[];

/** Every witness's reading of every name, with where it is. */
const readings = names.flatMap((name) =>
  PLANETARY_NAME_WITNESSES.flatMap((witness) => {
    const reading = readingOf(name, witness);
    return reading ? [{ name, witness, reading }] : [];
  }),
);

/**
 * What a reading's Hebrew makes of its number, counted as its `count`
 * says: the sum of its letters, or with `finals` the final letters at 500
 * to 900. For `pairs`, the number each pair of letters makes, or `NaN`
 * where the pairs do not agree.
 */
function computed(reading: PlanetaryNameReading): number {
  const he = reading.he ?? "";
  if (reading.count === "pairs") {
    const letters = [...he.replace(/\s/g, "")];
    const pairs = Array.from({ length: letters.length / 2 }, (_, i) =>
      letters.slice(2 * i, 2 * i + 2).reduce((a, l) => a + letterValue(l), 0),
    );
    return letters.length % 2 === 0 && new Set(pairs).size === 1
      ? pairs[0]
      : Number.NaN;
  }
  return hebrewValue(he, { finals: reading.count === "finals" });
}

const exceptionOf = (nameId: string, witness: PlanetaryNameWitness) =>
  exceptionRows.find(
    (row) => row.planetaryNameId === nameId && row.witness === witness,
  );

describe("the planetary names", () => {
  it("are keyed by id, each of a planet with a kamea", () => {
    for (const [key, name] of Object.entries(planetaryNames)) {
      expect(name.id).toBe(key);
      expect(KAMEA_PLANETS, key).toContain(name.planetId);
    }
  });

  it("list the witnesses the schema allows, in order", () => {
    const keys = Object.keys(
      (
        schemas.planetaryName as unknown as {
          pipe: [{ entries: { witnesses: { pipe: [{ entries: object }] } } }];
        }
      ).pipe[0].entries.witnesses.pipe[0].entries,
    );
    expect(keys).toEqual([...PLANETARY_NAME_WITNESSES]);
    expect(Object.isFrozen(PLANETARY_NAME_WITNESSES)).toBe(true);
  });

  it("give each planet one intelligence and one spirit, the ones it names", () => {
    for (const planetId of KAMEA_PLANETS) {
      const own = names.filter((name) => name.planetId === planetId);
      const ids = (role: string) =>
        own.filter((name) => name.role === role).map((name) => name.id);
      expect(ids("intelligence"), planetId).toEqual([
        planets[planetId].intelligenceId,
      ]);
      expect(ids("spirit"), planetId).toEqual([planets[planetId].spiritId]);
    }
    const others = (role: string) =>
      names.filter((name) => name.role === role).map((name) => name.id);
    expect(others("intelligences")).toEqual(["bne-seraphim"]);
    expect(others("intelligenceOfIntelligences")).toEqual([
      "malcha-betharsisim",
    ]);
    expect(others("spiritOfSpirits")).toEqual(["schedbarschemoth-schartathan"]);
  });

  // Text-neutral in K1 (plan 093): the pages print these as they did when
  // they capitalised the ids.
  it("show the names the planets named as their ids capitalised", () => {
    for (const planetId of KAMEA_PLANETS)
      for (const id of [
        planets[planetId].intelligenceId,
        planets[planetId].spiritId,
      ]) {
        const name = planetaryNames[id as keyof typeof planetaryNames];
        expect(name.name.roman).toBe(id[0].toUpperCase() + id.slice(1));
      }
  });

  it("trace Agrippa's Hebrew, and divide only where it is one word", () => {
    for (const name of names) {
      const he = name.witnesses.agrippa1533?.he;
      expect(tracedSpelling(name), name.id).toBe(name.division ?? he);
      if (name.division)
        expect(name.division.replace(/ /g, ""), name.id).toBe(he);
    }
    expect(
      names.filter((name) => name.division).map((name) => name.id),
    ).toEqual(["schedbarschemoth-schartathan"]);
    expect(tracedSpelling(planetaryNames.shelachel)).toBeUndefined();
  });

  it("leave Shelachel without a witness", () => {
    expect(planetaryNames.shelachel.witnesses).toEqual({});
    expect(
      names.filter((name) => !tracedSpelling(name)).map((n) => n.id),
    ).toEqual(["shelachel"]);
  });
});

describe("every printed number", () => {
  it("has Hebrew to be checked against", () => {
    for (const { name, witness, reading } of readings)
      if (reading.number !== undefined)
        expect(reading.he, `${name.id} ${witness}`).toBeDefined();
  });

  it("is its Hebrew's sum, or a row of planetaryNameException", () => {
    const unexplained = readings
      .filter(({ reading }) => reading.number !== undefined)
      .filter(({ name, witness, reading }) => {
        if (computed(reading) === reading.number) return false;
        return !exceptionOf(name.id, witness);
      })
      .map(
        ({ name, witness, reading }) =>
          `${name.id} ${witness}: ${reading.number}, the Hebrew ${computed(reading)}`,
      );
    expect(unexplained).toEqual([]);
  });
});

describe("the exceptions", () => {
  it("are keyed by name and witness, one a reading", () => {
    for (const [key, row] of Object.entries(exceptions)) {
      expect(row.id).toBe(key);
      expect(key).toBe(`${row.planetaryNameId}-${row.witness}`);
    }
  });

  it("are each still needed, and say what the page and the Hebrew say", () => {
    for (const row of exceptionRows) {
      const name =
        planetaryNames[row.planetaryNameId as keyof typeof planetaryNames];
      const reading =
        name && readingOf(name, row.witness as PlanetaryNameWitness);
      expect(reading, row.id).toBeDefined();
      if (!reading) continue;
      expect([row.id, row.printed], "printed").toEqual([
        row.id,
        reading.number,
      ]);
      expect([row.id, row.expected], "expected").toEqual([
        row.id,
        computed(reading),
      ]);
      expect([row.id, row.leaf], "leaf").toEqual([row.id, reading.leaf]);
      // A stale row: the number is now the sum, and the row explains nothing.
      expect(row.printed, `${row.id} is stale`).not.toBe(row.expected);
    }
  });

  it("name where an inherited difference comes from, which has it too", () => {
    for (const row of exceptionRows) {
      if (row.whose !== "inherited") {
        expect(row.from, row.id).toBeUndefined();
        continue;
      }
      expect(row.from, row.id).toBeDefined();
      const earlier = exceptionOf(
        row.planetaryNameId,
        row.from as PlanetaryNameWitness,
      );
      expect(earlier?.printed, `${row.id} from ${row.from}`).toBe(row.printed);
      expect(
        PLANETARY_NAME_WITNESSES.indexOf(row.from as PlanetaryNameWitness),
      ).toBeLessThan(PLANETARY_NAME_WITNESSES.indexOf(row.witness));
    }
  });

  it("are these nineteen: plan 093's discrepancies 1 to 6 as printed, and 1651's Taphthartharath", () => {
    expect(exceptionRows.map((row) => row.id)).toEqual([
      "bartzabel-agrippa1533",
      "bartzabel-agrippa1651",
      "bartzabel-barrett1801",
      "sol-eloh-agrippa1651",
      "sorath-agrippa1651",
      "sorath-barrett1801",
      "kedemel-agrippa1533",
      "kedemel-agrippa1651",
      "bne-seraphim-agrippa1533",
      "bne-seraphim-barrett1801",
      "tiriel-crowley777",
      "taphthartharath-agrippa1651",
      "chasmodai-agrippa1651",
      "chasmodai-barrett1801",
      "schedbarschemoth-schartathan-agrippa1651",
      "schedbarschemoth-schartathan-barrett1801",
      "malcha-betharsisim-agrippa1651",
      "malcha-betharsisim-barrett1801",
      "malcha-betharsisim-crowley777",
    ]);
  });
});

describe("the counts a reading declares", () => {
  it("are needed where they are given", () => {
    for (const { name, witness, reading } of readings)
      if (reading.count)
        expect(
          hebrewValue(reading.he ?? ""),
          `${name.id} ${witness} counts ${reading.count}`,
        ).not.toBe(reading.number);
  });

  it("reach the Moon's two long names in 1533 only with the finals", () => {
    const luna = readingOf(planetaryNames["malcha-betharsisim"], "agrippa1533");
    const spirits = readingOf(
      planetaryNames["schedbarschemoth-schartathan"],
      "agrippa1533",
    );
    for (const reading of [luna, spirits]) {
      expect(reading?.count).toBe("finals");
      expect(hebrewValue(reading?.he ?? "", { finals: true })).toBe(3321);
    }
  });

  it("make Asboga's 8 three times, the eight extended", () => {
    const asboga = readingOf(planetaryNames["mercury-asboga"], "agrippa1533");
    expect(asboga && computed(asboga)).toBe(8);
    expect(computed({ he: "אזבוגו", count: "pairs" })).toBeNaN();
    expect(computed({ he: "אזב", count: "pairs" })).toBeNaN();
  });
});

describe("the planet's intelligenceOfIntelligences, deprecated", () => {
  it("is the Moon's malcha-betharsisim row", () => {
    const old = planets.luna.intelligenceOfIntelligences;
    const row = planetaryNames["malcha-betharsisim"];
    expect(old?.he).toBe(row.witnesses.agrippa1533?.he);
    expect(old?.roman.agrippa1533).toBe(row.witnesses.agrippa1533?.roman);
    expect(old?.roman.crowley777).toBe(row.witnesses.crowley777?.roman);
    // Regardie prints capitals, which planets.json5 wrote in title case.
    expect(old?.roman.regardie1940.toUpperCase()).toBe(
      row.witnesses.regardie1940?.roman,
    );
    expect(row.name.roman).toBe(old?.roman.agrippa1533);
  });
});
