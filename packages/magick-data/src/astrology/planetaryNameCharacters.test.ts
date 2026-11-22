import { describe, expect, it } from "vitest";
import { traceHebrew } from "./aiqBekar.ts";
import kameas, { type KameaPlanetId } from "./kameas.ts";
import characters, {
  type PlanetaryNameCharacter,
} from "./PlanetaryNameCharacters.ts";
import planetaryNames, {
  PLANETARY_NAME_WITNESSES,
  type PlanetaryName,
  readingOf,
} from "./PlanetaryNames.ts";

const rows = Object.values(characters) as PlanetaryNameCharacter[];

const nameOf = (row: PlanetaryNameCharacter): PlanetaryName =>
  planetaryNames[row.planetaryNameId as keyof typeof planetaryNames];

/** The row's spelling traced on its planet's square, without and with finals. */
function traces(row: PlanetaryNameCharacter): [number[][], number[][]] {
  const planetId = nameOf(row).planetId as KameaPlanetId;
  return [
    traceHebrew(row.spelling, planetId),
    traceHebrew(row.spelling, planetId, { finals: true }),
  ];
}

/** A Hebrew final form. */
const FINAL = /[ךםןףץ]/;

describe("Agrippa's characters", () => {
  it("are keyed by name and witness, each of a planetary name", () => {
    for (const [key, row] of Object.entries(characters)) {
      expect(row.id).toBe(key);
      expect(key).toBe(`${row.planetaryNameId}-${row.witness}`);
      expect(nameOf(row), key).toBeDefined();
    }
  });

  it("trace a spelling some witness gives the name, or its division", () => {
    for (const row of rows) {
      const name = nameOf(row);
      const spellings = [
        name.division,
        ...PLANETARY_NAME_WITNESSES.map(
          (witness) => readingOf(name, witness)?.he,
        ),
      ].filter((he) => he !== undefined);
      expect(spellings, row.id).toContain(row.spelling);
    }
  });

  it("give every name with a 1533 character both witnesses' figures", () => {
    const of = (witness: string) =>
      rows
        .filter((row) => row.witness === witness)
        .map((row) => row.planetaryNameId)
        .sort();
    expect(of("regardie1940")).toEqual(of("agrippa1533"));
    expect(of("agrippa1533")).toHaveLength(16);
  });

  it("are on 1533's leaves of the squares, and on each planet's leaf in 1940", () => {
    for (const row of rows) {
      if (row.witness === "agrippa1533")
        expect(row.leaf, row.id).toMatch(/^n16[4-8]$/);
      else
        expect(row.leaf, row.id).toBe(
          readingOf(nameOf(row), "regardie1940")?.leaf,
        );
    }
  });
});

describe("the verdicts", () => {
  it("read no cells for a match, and name no departures", () => {
    for (const row of rows.filter((row) => row.verdict === "match")) {
      expect(row.cellsRead, row.id).toBeUndefined();
      expect(row.departures, row.id).toEqual([]);
    }
  });

  it("read the cells of a partial, on the square and off its trace either way", () => {
    for (const row of rows.filter((row) => row.verdict === "partial")) {
      const cells = row.cellsRead;
      expect(cells, row.id).toBeDefined();
      if (!cells) continue;
      const square = kameas[nameOf(row).planetId as KameaPlanetId].length ** 2;
      for (const cell of cells.flat()) {
        expect(cell, row.id).toBeGreaterThanOrEqual(1);
        expect(cell, row.id).toBeLessThanOrEqual(square);
      }
      const [ordinary, finals] = traces(row);
      expect(cells, `${row.id} without finals`).not.toEqual(ordinary);
      expect(cells, `${row.id} with finals`).not.toEqual(finals);
      expect(row.departures.length, row.id).toBeGreaterThan(0);
    }
  });

  it("name the departures of a no", () => {
    for (const row of rows.filter((row) => row.verdict === "no"))
      expect(row.departures.length, row.id).toBeGreaterThan(0);
  });

  it("count finals mixed only where the cells are read, and as final only where there is one", () => {
    for (const row of rows) {
      if (row.finals === "mixed") expect(row.cellsRead, row.id).toBeDefined();
      if (!FINAL.test(row.spelling))
        expect(row.finals, row.id).toBe("ordinary");
    }
  });

  it("say how they were reconciled exactly where the judges differ", () => {
    for (const row of rows)
      expect(row.note !== undefined, row.id).toBe(
        row.judges.opus !== row.judges.fable,
      );
  });

  // Pinned, so that a changed verdict is a deliberate edit here too.
  it("are 11 matches, 19 partials and 2 that are no trace", () => {
    const count = (verdict: string) =>
      rows.filter((row) => row.verdict === verdict).length;
    expect([count("match"), count("partial"), count("no")]).toEqual([
      11, 19, 2,
    ]);
    expect(rows).toHaveLength(32);
  });

  it("differ between the judges on these seven", () => {
    expect(
      rows
        .filter((row) => row.judges.opus !== row.judges.fable)
        .map((row) => `${row.id}: ${row.judges.opus}/${row.judges.fable}`),
    ).toEqual([
      "bartzabel-agrippa1533: match/partial",
      "bartzabel-regardie1940: match/partial",
      "kedemel-regardie1940: match/partial",
      "tiriel-agrippa1533: match/partial",
      "tiriel-regardie1940: match/partial",
      "schedbarschemoth-schartathan-agrippa1533: no/partial",
      "schedbarschemoth-schartathan-regardie1940: no/partial",
    ]);
  });
});

describe("the blind readings", () => {
  it("are given for exactly Agrippa's 1533 figures, by both readers", () => {
    for (const row of rows) {
      if (row.witness !== "agrippa1533") {
        expect(row.readings, row.id).toBeUndefined();
        continue;
      }
      expect(row.readings?.opus.length, row.id).toBeGreaterThan(0);
      expect(row.readings?.fable.length, row.id).toBeGreaterThan(0);
    }
  });

  it("put every vertex inside the figure's region", () => {
    for (const row of rows)
      for (const [reader, strokes] of Object.entries(row.readings ?? {}))
        for (const { vertices } of strokes)
          for (const { x, y } of vertices) {
            const where = `${row.id} ${reader} (${x}, ${y})`;
            expect(x, where).toBeLessThanOrEqual(row.region.width);
            expect(y, where).toBeLessThanOrEqual(row.region.height);
          }
  });

  it("end only an open stroke, and mark its ends and nothing else", () => {
    for (const row of rows)
      for (const [reader, strokes] of Object.entries(row.readings ?? {}))
        for (const { closed, vertices } of strokes)
          for (const vertex of vertices) {
            const where = `${row.id} ${reader}`;
            if (vertex.kind === "end") {
              expect(closed, where).toBe(false);
              expect(vertex.mark, where).toBeDefined();
            } else expect(vertex.mark, where).toBeUndefined();
          }
  });

  it("keep a curve's points, a hook's curls, a bar's ends and a ring on the line inside the region, on the marks they belong to", () => {
    let kept = 0;
    for (const row of rows)
      for (const [reader, strokes] of Object.entries(row.readings ?? {}))
        for (const stroke of strokes) {
          const points: (readonly number[])[] = [
            ...(("rings" in stroke && stroke.rings) || []),
          ];
          for (const vertex of stroke.vertices) {
            const extra = vertex as {
              mark?: string;
              via?: readonly (readonly number[])[];
              hook?: readonly (readonly (readonly number[])[])[];
              bar?: readonly (readonly number[])[];
            };
            if (extra.hook) expect(extra.mark, row.id).toBe("hook");
            if (extra.bar) expect(extra.mark, row.id).toBe("bar");
            points.push(
              ...(extra.via ?? []),
              ...(extra.hook ?? []).flat(),
              ...(extra.bar ?? []),
            );
          }
          kept += points.length;
          for (const [x, y] of points) {
            const where = `${row.id} ${reader} (${x}, ${y})`;
            expect(x, where).toBeLessThanOrEqual(row.region.width);
            expect(y, where).toBeLessThanOrEqual(row.region.height);
          }
        }
    // Fable's oval of the spirit of spirits, its ring, the curls of
    // Bartzabel, Sorath and Malcha, Chasmodai's and the Bne Seraphim's
    // bars, and Opus' arcs, given in words, as points.
    expect(kept).toBe(9 + 1 + 4 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 3 + 1);
  });
});
