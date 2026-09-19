import { describe, expect, it } from "vitest";
import christianChoirs from "./ChristianChoirs";
import { ANGEL_COUNT, choirOf } from "./seventyTwoAngelsDerived";

describe("the nine choirs", () => {
  it("names all nine, in Lenain's order", () => {
    expect(christianChoirs.map((choir) => choir.id)).toEqual([
      "seraphim",
      "cherubim",
      "thrones",
      "dominations",
      "powers",
      "virtues",
      "principalities",
      "archangels",
      "angels",
    ]);
  });

  it("gives every choir both languages", () => {
    for (const choir of christianChoirs) {
      expect(choir.name.en).toBeTruthy();
      expect(choir.name.fr).toBeTruthy();
    }
  });

  it("is indexed by the choir number the derivation gives", () => {
    for (let no = 1; no <= ANGEL_COUNT; no++)
      expect(christianChoirs[choirOf(no) - 1]).toBeDefined();
    // The entries that declare a choir, and what Lenain calls it there.
    expect(christianChoirs[choirOf(1) - 1].name.fr).toBe("Séraphins");
    expect(christianChoirs[choirOf(9) - 1].name.fr).toBe("Chérubins");
    expect(christianChoirs[choirOf(17) - 1].name.fr).toBe("Trônes");
    expect(christianChoirs[choirOf(25) - 1].name.fr).toBe("Dominations");
    expect(christianChoirs[choirOf(33) - 1].name.fr).toBe("Puissances");
    expect(christianChoirs[choirOf(41) - 1].name.fr).toBe("Vertus");
    expect(christianChoirs[choirOf(49) - 1].name.fr).toBe("Principautés");
    expect(christianChoirs[choirOf(57) - 1].name.fr).toBe("Archanges");
    expect(christianChoirs[choirOf(65) - 1].name.fr).toBe("Anges");
  });
});
