import { describe, expect, it } from "vitest";
import { pathTarget } from "./pathTarget";

describe("pathTarget", () => {
  it("ends on a field of the table it started in", () => {
    expect(pathTarget("sephirah", "index")).toEqual({
      table: "sephirah",
      field: "index",
      many: false,
    });
    expect(pathTarget("sephirah", "name.he")).toEqual({
      table: "sephirah",
      field: "name.he",
      many: false,
    });
    // A field only some rows carry is still a field.
    expect(pathTarget("sephirah", "scent")?.field).toBe("scent");
  });

  it("hops through a link, and through two", () => {
    expect(pathTarget("sephirah", "godName.name.he")).toEqual({
      table: "godName",
      field: "name.he",
      many: false,
    });
    expect(pathTarget("sephirah", "gdGrade.planet.symbol")).toEqual({
      table: "planet",
      field: "symbol",
      many: false,
    });
  });

  it("hops through a link declared inside a nested block", () => {
    expect(pathTarget("tolPath", "hermetic.hebrewLetter.letter.he")).toEqual({
      table: "hebrewLetter",
      field: "letter.he",
      many: false,
    });
    expect(pathTarget("tolPath", "hebrew.hebrewLetter.letter.name")).toEqual({
      table: "hebrewLetter",
      field: "letter.name",
      many: false,
    });
    // The block is a field of the row; the accessor is only inside it.
    expect(pathTarget("tolPath", "hebrewLetter")).toBeUndefined();
  });

  it("ends on the row where the path is a link", () => {
    expect(pathTarget("sephirah", "archangel")).toEqual({
      table: "archangel",
      field: null,
      many: false,
    });
  });

  it("reads a list only through an index, as dot-prop does", () => {
    expect(pathTarget("tetragram", "planets")).toEqual({
      table: "planet",
      field: null,
      many: true,
    });
    expect(pathTarget("tetragram", "planets.0.symbol")).toEqual({
      table: "planet",
      field: "symbol",
      many: false,
    });
    expect(pathTarget("tetragram", "planets.symbol")).toBeUndefined();
  });

  it("walks a table the data holds as an array", () => {
    // The astrology houses are rows in a list, and link to a sign all the same.
    expect(pathTarget("house", "zodiac.symbol")).toEqual({
      table: "zodiac",
      field: "symbol",
      many: false,
    });
    expect(pathTarget("house", "motto")?.table).toBe("house");
  });

  it("follows a derived back-link", () => {
    expect(pathTarget("planet", "sephirot")).toEqual({
      table: "sephirah",
      field: null,
      many: true,
    });
    expect(pathTarget("planet", "sephirot.0.name.roman")).toEqual({
      table: "sephirah",
      field: "name.roman",
      many: false,
    });
    expect(pathTarget("element", "elemental.name.en")).toEqual({
      table: "elemental",
      field: "name.en",
      many: false,
    });
  });

  it("rejects a path the data and the graph do not have", () => {
    expect(pathTarget("sephirah", "nosuch")).toBeUndefined();
    expect(pathTarget("sephirah", "name.nosuch")).toBeUndefined();
    expect(pathTarget("sephirah", "godName.nosuch")).toBeUndefined();
    // An id is a field; the row it names is reached by the accessor.
    expect(pathTarget("sephirah", "godNameId.name")).toBeUndefined();
    expect(pathTarget("sephirah", "")).toBeUndefined();
    expect(pathTarget("sephirah", "name..he")).toBeUndefined();
  });

  it("keeps an id-shaped field that is not a link", () => {
    // `orderId` is an enum and `hermetic.tarotId` is external; both are read
    // as fields, and neither makes an accessor.
    expect(pathTarget("gdGrade", "orderId")?.table).toBe("gdGrade");
    expect(pathTarget("tolPath", "hermetic.tarotId")?.field).toBe(
      "hermetic.tarotId",
    );
  });

  it("walks tables the caller hands it", () => {
    const sources = {
      sephirah: { keter: { id: "keter", made: { up: 1 } } },
      godName: { ehiyeh: { id: "ehiyeh" } },
    };
    expect(pathTarget("sephirah", "made.up", sources)).toEqual({
      table: "sephirah",
      field: "made.up",
      many: false,
    });
    // The link is in the graph, and its target is in these sources.
    expect(pathTarget("sephirah", "godName.id", sources)?.table).toBe(
      "godName",
    );
    // A link whose target the caller did not hand over goes nowhere.
    expect(
      pathTarget("sephirah", "archangel.name.he", sources),
    ).toBeUndefined();
    expect(pathTarget("sephirah", "name.he", sources)).toBeUndefined();
    // Nor does a table the caller did not hand over at all.
    expect(pathTarget("planet", "symbol", {})).toBeUndefined();
  });
});
