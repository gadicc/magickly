import { describe, expect, it, vi } from "vitest";

/**
 * The parts of the graph format the entity pages brought into use (plan 036),
 * asserted on the real data: a back-link that must be unique rather than a
 * list, one derived from a list, and one derived from a link inside a nested
 * block. Until then the real graph declared none of them, and this file
 * exercised them against a graph of its own.
 *
 * The one part the data still does not use is a link that names its own
 * accessor. That is exercised against a table written for the test, added to
 * the real graph under a name no real `assemble()` is handed, so that every
 * other assertion here reads the graph the app does.
 */
vi.mock("./graph", async (importOriginal) => {
  const real = await importOriginal<typeof import("./graph")>();
  const graph = {
    ...real.graph,
    ruled: { links: { archangelId: { to: "archangel", as: "ruler" } } },
  };
  return { ...real, graph, default: graph };
});

import { assemble, problemsOf } from "./assemble";
import { type Tables, tables } from "./tables";

type Fake = Record<string, unknown>;

/** The real tables with one of them replaced by something wrong. */
const planted = (name: keyof Tables, table: unknown) =>
  assemble({ ...tables, [name]: table } as Tables);

describe("what the real graph declares", () => {
  it("derives a singular back-link, undefined where nothing points at the row", () => {
    const data = assemble(tables);
    expect(problemsOf(data)).toEqual([]);
    expect(data.planet.sol.gdGrade?.id).toBe("5=6");
    expect(data.planet.sol.alchemySymbol?.id).toBe("gold");
    expect(data.hebrewLetter.resh.planet).toBe(data.planet.sol);
    // Aleph is a mother letter, and only the seven doubles carry a planet;
    // the key is there and the value is not.
    expect(Object.hasOwn(data.hebrewLetter.alef, "planet")).toBe(true);
    expect(data.hebrewLetter.alef.planet).toBeUndefined();
    expect(data.planet.uranus.gdGrade).toBeUndefined();
  });

  it("derives one from a link inside a nested block, at the top of the target", () => {
    // The two attributions deal the letters differently: Aleph is Keter to
    // Chochmah on the Hermetic tree and Chesed to Gevurah on the Hebrew one.
    const { hebrewLetter } = assemble(tables);
    expect(hebrewLetter.alef.hermeticPath?.id).toBe("1_2");
    expect(hebrewLetter.alef.hebrewPath?.id).toBe("4_5");
    // A final form is no path's letter on either tree.
    expect(hebrewLetter["kaf-sofit"].hermeticPath).toBeUndefined();
    expect(hebrewLetter["kaf-sofit"].hebrewPath).toBeUndefined();
  });

  it("derives a back-link from a list, and from a row that has no list", () => {
    const data = assemble(tables);
    expect(data.planet.venus.tetragrams.map((t) => t.id)).toEqual([
      "amissio",
      "caput_draconis",
      "puella",
    ]);
    expect(data.planet.earth.tetragrams).toEqual([]);

    // Every real figure lists its planets, so the one that lists none is
    // planted: it names no planet, and that is no problem.
    const { planetIds: _planetIds, ...carcer } = tables.tetragram.carcer;
    const listless = planted("tetragram", { ...tables.tetragram, carcer });
    expect(problemsOf(listless)).toEqual([]);
    expect(listless.planet.saturn.tetragrams.map((t) => t.id)).toEqual([
      "cauda_draconis",
      "tristitia",
    ]);
  });

  it("leaves a back-link alone where the link itself does not resolve", () => {
    const data = planted("gdGrade", {
      ...tables.gdGrade,
      "5=6": { ...tables.gdGrade["5=6"], planetId: "nowhere" },
    });
    expect(problemsOf(data)).toMatchObject([
      { kind: "dangling", table: "gdGrade", row: "5=6", field: "planetId" },
    ]);
    expect(data.planet.sol.gdGrade).toBeUndefined();
  });

  it("reports a second row claiming the same singular back-link", () => {
    // Venus's grade given Sol, which Adeptus Minor already has.
    const data = planted("gdGrade", {
      ...tables.gdGrade,
      "4=7": { ...tables.gdGrade["4=7"], planetId: "sol" },
    });
    expect(problemsOf(data)).toMatchObject([
      {
        kind: "inverse-not-unique",
        table: "planet",
        row: "sol",
        field: "gdGrade",
      },
    ]);
    // The first one in table order keeps it, and 4=7 comes before 5=6.
    expect(data.planet.sol.gdGrade?.id).toBe("4=7");
    expect(data.planet.venus.gdGrade).toBeUndefined();
  });
});

describe("what it does not declare yet", () => {
  it("names the accessor itself where the link says so", () => {
    const data = assemble({
      ruled: { keter: { id: "keter", archangelId: "metatron" } },
      archangel: { metatron: { id: "metatron" } },
    } as unknown as Pick<Tables, "sephirah">) as unknown as Record<
      string,
      Record<string, Fake>
    >;
    expect(problemsOf(data)).toEqual([]);
    expect(Object.hasOwn(data.ruled.keter, "archangel")).toBe(false);
    expect((data.ruled.keter.ruler as Fake).id).toBe("metatron");
  });
});
