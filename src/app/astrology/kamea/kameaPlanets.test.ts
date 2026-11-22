import { PLANETARY_SEAL_LEAVES } from "magick-components/astrology/PlanetarySeal";
import kameas, { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import { describe, expect, it } from "vitest";
import { KAMEA_IMAGE_PLANETS } from "@/render/contracts/kamea";
import {
  AGRIPPA_SQUARE_LEAVES,
  constantOf,
  isKameaPlanet,
  KAMEA_PLANET_LABELS,
  KAMEA_SQUARE_LABELS,
  kameaConstants,
  kameaConstruction,
  kameaNeighbours,
  kameaPath,
  REGARDIE_SQUARE_LEAVES,
} from "./kameaPlanets";

describe("the seven kameas as the pages present them", () => {
  it("are the image contract's seven, in the Chaldean order", () => {
    expect([...KAMEA_PLANETS]).toEqual([...KAMEA_IMAGE_PLANETS]);
    for (const labels of [
      KAMEA_PLANET_LABELS,
      KAMEA_SQUARE_LABELS,
      REGARDIE_SQUARE_LEAVES,
      AGRIPPA_SQUARE_LEAVES,
    ])
      expect(Object.keys(labels)).toEqual([...KAMEA_PLANETS]);
    expect(kameaPath("sol")).toBe("/astrology/kamea/sol");
    expect(isKameaPlanet("luna")).toBe(true);
    expect(isKameaPlanet("moon")).toBe(false);
    expect(isKameaPlanet("sigils")).toBe(false);
  });

  it("give each square its four numbers, held to the square itself", () => {
    expect(kameaConstants("saturn")).toEqual({
      order: 3,
      cells: 9,
      line: 15,
      total: 45,
    });
    expect(kameaConstants("sol")).toEqual({
      order: 6,
      cells: 36,
      line: 111,
      total: 666,
    });
    expect(kameaConstants("luna")).toEqual({
      order: 9,
      cells: 81,
      line: 369,
      total: 3321,
    });
    for (const planet of KAMEA_PLANETS) {
      const square = kameas[planet];
      const { order, cells, line, total } = kameaConstants(planet);
      expect(square).toHaveLength(order);
      expect(Math.max(...square.flat())).toBe(cells);
      for (const row of square) expect(row.reduce((a, b) => a + b)).toBe(line);
      expect(square.flat().reduce((a, b) => a + b)).toBe(total);
    }
  });

  it("say which of the four a name's number is, never two", () => {
    expect(constantOf("saturn", 3)).toBe("order");
    expect(constantOf("saturn", 9)).toBe("cells");
    expect(constantOf("saturn", 15)).toBe("line");
    expect(constantOf("saturn", 45)).toBe("total");
    // Kedemel's misprint is none of them; the Bne Seraphim's 1225 is the
    // sum of Venus' square.
    expect(constantOf("venus", 157)).toBeNull();
    expect(constantOf("venus", 1225)).toBe("total");
    expect(constantOf("venus", undefined)).toBeNull();
    for (const planet of KAMEA_PLANETS)
      expect(new Set(Object.values(kameaConstants(planet))).size).toBe(4);
  });

  it("make the odd squares, the squares of four and eight, and the Sun's apart", () => {
    expect(KAMEA_PLANETS.map(kameaConstruction)).toEqual([
      "odd",
      "doublyEven",
      "odd",
      "written",
      "odd",
      "doublyEven",
      "odd",
    ]);
  });

  it("find Agrippa's squares on the seals' leaves", () => {
    expect(AGRIPPA_SQUARE_LEAVES).toEqual(PLANETARY_SEAL_LEAVES);
  });

  it("link each square to its neighbours, none past either end", () => {
    expect(kameaNeighbours("saturn")).toEqual({
      prev: undefined,
      next: "jupiter",
    });
    expect(kameaNeighbours("sol")).toEqual({ prev: "mars", next: "venus" });
    expect(kameaNeighbours("luna")).toEqual({
      prev: "mercury",
      next: undefined,
    });
  });
});
