import { describe, expect, it } from "vitest";
import {
  doublyEvenKamea,
  KAMEA_ORDERS,
  type Kamea,
  kamea,
  oddKamea,
  PLANET_NAMES,
  PLANETS,
} from "./kameas";

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
    expect([...KAMEA_ORDERS.values()]).toEqual([3, 4, 5, 6, 7, 8, 9]);
    for (const planet of PLANETS) {
      const square = kamea(planet);
      expect(square, planet).toHaveLength(KAMEA_ORDERS.get(planet) as number);
      expect(isMagic(square), planet).toBe(true);
      expect(PLANET_NAMES.has(planet), planet).toBe(true);
    }
  });

  it("are Agrippa's squares, row by row as he writes them", () => {
    // De occulta philosophia (1533), II.22: each square's first row.
    expect(PLANETS.map((planet) => kamea(planet)[0].join(" "))).toEqual([
      "4 9 2",
      "4 14 15 1",
      "11 24 7 20 3",
      "6 32 3 34 35 1",
      "22 47 16 41 10 35 4",
      "8 58 59 5 4 62 63 1",
      "37 78 29 70 21 62 13 54 5",
    ]);
    expect(kamea("saturn")).toEqual([
      [4, 9, 2],
      [3, 5, 7],
      [8, 1, 6],
    ]);
    expect(kamea("jupiter")).toEqual([
      [4, 14, 15, 1],
      [9, 7, 6, 12],
      [5, 11, 10, 8],
      [16, 2, 3, 13],
    ]);
    // The Moon's centre is 41, as every odd square's is its middle number.
    expect(kamea("moon")[4][4]).toBe(41);
  });

  it("are built by constructions that make magic squares of any such order", () => {
    for (const n of [3, 5, 7, 9, 11, 13])
      expect(isMagic(oddKamea(n)), `${n}`).toBe(true);
    for (const n of [4, 8, 12, 16])
      expect(isMagic(doublyEvenKamea(n)), `${n}`).toBe(true);
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
