import kameas from "magick-data/astrology/kameas";
import planets from "magick-data/astrology/planets";
import { describe, expect, it } from "vitest";
import {
  HALL_KAMEA_PLANET_IDS,
  HALL_PLANET_NAMES,
  HALL_PLANETS,
} from "./planets.ts";

describe("the hall's planets", () => {
  it("name magick-data's planets, as its table names them", () => {
    expect([...HALL_KAMEA_PLANET_IDS.keys()]).toEqual([...HALL_PLANETS]);
    expect([...HALL_PLANET_NAMES.keys()]).toEqual([...HALL_PLANETS]);
    for (const planet of HALL_PLANETS) {
      const id = HALL_KAMEA_PLANET_IDS.get(planet);
      if (!id) throw new Error(planet);
      expect(planets[id].name.en.en, planet).toBe(
        HALL_PLANET_NAMES.get(planet),
      );
      expect(kameas[id], planet).toBeDefined();
    }
  });

  it("keep the hall's own words, which saved halls hold", () => {
    expect(HALL_KAMEA_PLANET_IDS.get("sun")).toBe("sol");
    expect(HALL_KAMEA_PLANET_IDS.get("moon")).toBe("luna");
  });
});
