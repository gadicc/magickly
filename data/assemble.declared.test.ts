import { describe, expect, it, vi } from "vitest";

/**
 * The parts of the graph format this data does not use yet: a link that names
 * its own accessor, a back-link that must be unique rather than a list, and a
 * list that derives one. All are exercised against a graph written for the
 * test, since the real one declares none of them.
 */
vi.mock("./graph", () => ({
  graph: {
    sephirah: {
      links: {
        archangelId: { to: "archangel", as: "ruler", inverse: "sephirah" },
      },
    },
    archangel: {},
    tetragram: {
      links: {
        planetIds: {
          to: "planet",
          many: true,
          inverse: "tetragrams",
          inverseMany: true,
        },
      },
    },
    planet: {},
  },
}));

import { assemble, problemsOf } from "./assemble";
import type { Tables } from "./tables";

type Fake = Record<string, unknown>;

const fake = (input: Record<string, Record<string, Fake>>) =>
  assemble(input as unknown as Pick<Tables, "sephirah">) as unknown as Record<
    string,
    Record<string, Fake>
  >;

describe("what the real graph does not declare", () => {
  it("names the accessor itself where the link says so", () => {
    const data = fake({
      sephirah: { keter: { id: "keter", archangelId: "metatron" } },
      archangel: { metatron: { id: "metatron" } },
    });
    expect(problemsOf(data)).toEqual([]);
    expect(Object.hasOwn(data.sephirah.keter, "archangel")).toBe(false);
    expect((data.sephirah.keter.ruler as Fake).id).toBe("metatron");
  });

  it("derives a singular back-link, undefined where nothing points at the row", () => {
    const data = fake({
      sephirah: {
        keter: { id: "keter", archangelId: "metatron" },
        binah: { id: "binah" },
      },
      archangel: { metatron: { id: "metatron" }, raziel: { id: "raziel" } },
    });
    expect(problemsOf(data)).toEqual([]);
    expect((data.archangel.metatron.sephirah as Fake).id).toBe("keter");
    expect(data.archangel.raziel.sephirah).toBeUndefined();
  });

  it("leaves a back-link alone where the link itself does not resolve", () => {
    const data = fake({
      sephirah: { keter: { id: "keter", archangelId: "nowhere" } },
      archangel: { metatron: { id: "metatron" } },
    });
    expect(problemsOf(data)).toMatchObject([{ kind: "dangling" }]);
    expect(data.archangel.metatron.sephirah).toBeUndefined();
  });

  it("derives a back-link from a list, and from a row that has no list", () => {
    const data = fake({
      tetragram: {
        via: { id: "via", planetIds: ["luna", "sol"] },
        carcer: { id: "carcer" },
      },
      planet: {
        luna: { id: "luna" },
        sol: { id: "sol" },
        mars: { id: "mars" },
      },
    });
    expect(problemsOf(data)).toEqual([]);
    expect((data.planet.luna.tetragrams as Fake[]).map((t) => t.id)).toEqual([
      "via",
    ]);
    expect(data.planet.mars.tetragrams).toEqual([]);
  });

  it("reports a second row claiming the same singular back-link", () => {
    const data = fake({
      sephirah: {
        keter: { id: "keter", archangelId: "metatron" },
        binah: { id: "binah", archangelId: "metatron" },
      },
      archangel: { metatron: { id: "metatron" } },
    });
    expect(problemsOf(data)).toMatchObject([
      {
        kind: "inverse-not-unique",
        table: "archangel",
        row: "metatron",
        field: "sephirah",
      },
    ]);
    // The first one in table order keeps it.
    expect((data.archangel.metatron.sephirah as Fake).id).toBe("keter");
  });
});
