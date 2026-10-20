import kameas from "magick-data/astrology/kameas";
import planets from "magick-data/astrology/planets";
import { describe, expect, it } from "vitest";
import { KAMEA_PLANET_IDS, PLANET_NAMES, PLANETS } from "./planets";

describe("the hall's planets", () => {
  it("name magick-data's planets, as its table names them", () => {
    expect([...KAMEA_PLANET_IDS.keys()]).toEqual([...PLANETS]);
    expect([...PLANET_NAMES.keys()]).toEqual([...PLANETS]);
    for (const planet of PLANETS) {
      const id = KAMEA_PLANET_IDS.get(planet);
      if (!id) throw new Error(planet);
      expect(planets[id].name.en.en, planet).toBe(PLANET_NAMES.get(planet));
      expect(kameas[id], planet).toBeDefined();
    }
  });

  it("keep the hall's own words, which saved halls hold", () => {
    expect(KAMEA_PLANET_IDS.get("sun")).toBe("sol");
    expect(KAMEA_PLANET_IDS.get("moon")).toBe("luna");
  });
});
