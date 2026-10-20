import { describe, expect, it } from "vitest";
import kameas, {
  doublyEvenKamea,
  KAMEA_PLANETS,
  type Kamea,
  MAX_KAMEA_ORDER,
  oddKamea,
} from "./kameas.ts";
import planets from "./Planets.ts";

/** Whether a square holds 1 to n² once each, every line summing alike. */
function isMagic(square: Kamea): boolean {
  const n = square.length;
  const sum = (n * (n * n + 1)) / 2;
  const values = square.flat();
  const lines = [
    ...square,
    ...square.map((_, j) => square.map((row) => row[j])),
    square.map((row, i) => row[i]),
    square.map((row, i) => row[n - 1 - i]),
  ];
  return (
    square.every((row) => row.length === n) &&
    new Set(values).size === n * n &&
    values.every((value) => Number.isInteger(value) && value >= 1) &&
    Math.max(...values) === n * n &&
    lines.every((line) => line.reduce((a, b) => a + b, 0) === sum)
  );
}

describe("the kameas", () => {
  it("are magic squares of the planets' orders, Saturn 3 to the Moon 9", () => {
    expect(Object.keys(kameas)).toEqual([...KAMEA_PLANETS]);
    expect(KAMEA_PLANETS.map((planet) => kameas[planet].length)).toEqual([
      3, 4, 5, 6, 7, 8, 9,
    ]);
    for (const planet of KAMEA_PLANETS)
      expect(isMagic(kameas[planet]), planet).toBe(true);
  });

  it("are keyed by the planet table's ids, the seven classical planets", () => {
    for (const planet of KAMEA_PLANETS)
      expect(planets[planet].kind, planet).toBe("planet");
    expect(KAMEA_PLANETS.map((planet) => planets[planet].name.en.en)).toEqual([
      "Saturn",
      "Jupiter",
      "Mars",
      "Sol",
      "Venus",
      "Mercury",
      "Luna",
    ]);
  });

  it("read nothing for names that are not planets", () => {
    const table = kameas as unknown as Record<string, unknown>;
    for (const name of [
      "constructor",
      "toString",
      "__proto__",
      "hasOwnProperty",
      "valueOf",
      "sun",
    ])
      expect(table[name], name).toBeUndefined();
    expect(Object.getPrototypeOf(kameas)).toBeNull();
  });

  it("are frozen, so no reader can change another's square", () => {
    expect(Object.isFrozen(kameas)).toBe(true);
    expect(Object.isFrozen(KAMEA_PLANETS)).toBe(true);
    for (const planet of KAMEA_PLANETS) {
      expect(Object.isFrozen(kameas[planet]), planet).toBe(true);
      expect(
        kameas[planet].every((row) => Object.isFrozen(row)),
        planet,
      ).toBe(true);
    }
  });

  it("are Agrippa's squares, row by row as he writes them", () => {
    // De occulta philosophia (1533), II.22: each square's first row.
    expect(KAMEA_PLANETS.map((planet) => kameas[planet][0].join(" "))).toEqual([
      "4 9 2",
      "4 14 15 1",
      "11 24 7 20 3",
      "6 32 3 34 35 1",
      "22 47 16 41 10 35 4",
      "8 58 59 5 4 62 63 1",
      "37 78 29 70 21 62 13 54 5",
    ]);
    expect(kameas.saturn).toEqual([
      [4, 9, 2],
      [3, 5, 7],
      [8, 1, 6],
    ]);
    expect(kameas.jupiter).toEqual([
      [4, 14, 15, 1],
      [9, 7, 6, 12],
      [5, 11, 10, 8],
      [16, 2, 3, 13],
    ]);
    // The Moon's centre is 41, as every odd square's is its middle number.
    expect(kameas.luna[4][4]).toBe(41);
  });

  it("are built by constructions that make magic squares of any such order", () => {
    for (const n of [3, 5, 7, 9, 11, 13])
      expect(isMagic(oddKamea(n)), `${n}`).toBe(true);
    for (const n of [4, 8, 12, 16])
      expect(isMagic(doublyEvenKamea(n)), `${n}`).toBe(true);
  });

  it("refuse orders their constructions do not build", () => {
    const refused = (build: (n: number) => unknown, n: number) => {
      try {
        build(n);
        return "built";
      } catch (error) {
        return error instanceof RangeError ? "RangeError" : String(error);
      }
    };
    for (const n of [-3, 0, 1, 2, 4, 6, 3.5, Number.NaN, Infinity, 101, 1001])
      expect(refused(oddKamea, n), `odd ${n}`).toBe("RangeError");
    for (const n of [-4, 0, 1, 2, 3, 5, 6, 10, 4.5, Number.NaN, 104])
      expect(refused(doublyEvenKamea, n), `doubly even ${n}`).toBe(
        "RangeError",
      );
    expect(MAX_KAMEA_ORDER).toBe(100);
    expect(isMagic(oddKamea(99))).toBe(true);
    expect(isMagic(doublyEvenKamea(100))).toBe(true);
    expect(() => oddKamea(4)).toThrow(
      "Not an order for the odd construction: 4 (an odd number from 3 to 100)",
    );
  });

  it("tells a broken square from a magic one", () => {
    expect(
      isMagic([
        [1, 2],
        [3, 4],
      ]),
    ).toBe(false);
    expect(
      isMagic([
        [4, 9, 2],
        [3, 5, 7],
        [8, 6, 1],
      ]),
    ).toBe(false);
  });
});
